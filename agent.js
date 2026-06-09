#!/usr/bin/env node
// ============================================================
// Daily Intelligence Agent v3 — Market + Tech
// LLM  : Groq free tier (no credit card, no cost)
// Search: Serper.dev free tier (2500 queries, no credit card)
// Notif : Telegram (free, no limit)
// Run   : node agent.js market | tech | both
// ============================================================

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

// In ES Modules (type:"module"), __dirname doesn't exist.
// We recreate it by converting the current file's URL to a path.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env for local development.
// On GitHub Actions, secrets are already in process.env (injected by the workflow),
// so this silently does nothing when .env is missing.
try { process.loadEnvFile(); } catch { /* .env not found — expected on CI */ }

// process.argv holds command-line arguments: [node, script, ...args]
// argv[2] is the first user-supplied argument, e.g. "node agent.js market" → "market"
const MODE    = process.argv[2] || "both";
const TODAY   = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
const OUT_DIR = path.join(__dirname, "reports");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ── Free-tier limits (verified June 2026) ───────────────────
// Groq  llama-3.3-70b-versatile : 30 RPM | 1000 RPD | 100K TPD
// Serper.dev                     : 2500 total queries
// Telegram Bot API               : unlimited
// GitHub Actions                 : 2000 min/month
// ────────────────────────────────────────────────────────────

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const SERPER_URL = "https://google.serper.dev/news"; // /news returns fresher results than /search

// ── Fail-fast env check ──────────────────────────────────────
// Called before any network request. Exits immediately with a clear message
// if a required key is missing — no confusing API errors downstream.
function checkEnv() {
  const errors = [];
  if (!process.env.GROQ_API_KEY)   errors.push("  GROQ_API_KEY   — get free at console.groq.com (no card)");
  if (!process.env.SERPER_API_KEY) errors.push("  SERPER_API_KEY — get free at serper.dev (no card, 2500 queries)");
  if (errors.length) {
    console.error("\n❌ MISSING API KEYS — agent cannot start.\n");
    console.error("Add these to your .env file (local) or GitHub Secrets (CI):\n");
    errors.forEach(e => console.error(e));
    console.error("\nSee SETUP.txt for step-by-step instructions.\n");
    process.exit(1);
  }
}

// ── Serper.dev web search ────────────────────────────────────
// Sends a search query and returns formatted results as a plain string,
// or a typed error object so the agent can mention the failure in the
// report instead of crashing the whole run.
async function webSearch(query) {
  try {
    const res = await fetch(SERPER_URL, {
      method:  "POST",
      headers: {
        "X-API-KEY":    process.env.SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      // gl:"in" = India region results, hl:"en" = English
      body: JSON.stringify({ q: query, num: 6, gl: "in", hl: "en" }),
    });

    // Map HTTP error codes to human-readable typed errors
    if (res.status === 401) return { error: "SERPER_INVALID_KEY",         message: "Serper API key is invalid or expired. Check SERPER_API_KEY in your .env / GitHub Secrets." };
    if (res.status === 403) return { error: "SERPER_FREE_TIER_EXHAUSTED", message: "Serper free tier (2500 queries) exhausted. Visit serper.dev to top up or create a new account." };
    if (res.status === 429) return { error: "SERPER_RATE_LIMITED",        message: "Serper rate limit hit. Wait 60 seconds and retry." };
    if (!res.ok)            return { error: "SERPER_HTTP_ERROR",          message: `Serper returned HTTP ${res.status}. Check your key and try again.` };

    const data  = await res.json();
    const items = data.news || data.organic || []; // .news from /news endpoint, .organic from /search
    if (items.length === 0) return `No results found for: "${query}"`;

    // Format as bullet points: title, 200-char snippet, source URL
    return items.slice(0, 5)
      .map(r => `• ${r.title}\n  ${(r.snippet || r.description || "").slice(0, 200)}\n  ${r.link || r.url}`)
      .join("\n\n");

  } catch (err) {
    // Network-level failure (no internet, DNS failure, timeout)
    return { error: "SERPER_NETWORK_ERROR", message: `Network error reaching Serper: ${err.message}` };
  }
}

// ── Groq LLM call ────────────────────────────────────────────
// Sends the full conversation history to Groq and returns the model's response.
// Groq uses the same API format as OpenAI (/chat/completions).
async function callGroq(messages) {
  const res = await fetch(GROQ_URL, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      messages,
      max_tokens:  3000,
      temperature: 0.2, // lower = more factual, less creative/hallucinated
      tools: [{
        type: "function",
        function: {
          name:        "web_search",
          description: "Search for current news, prices, and data. Call once per topic.",
          parameters:  {
            type:       "object",
            properties: { query: { type: "string" } },
            required:   ["query"],
          },
        },
      }],
    }),
  });

  if (res.status === 401) throw new Error("GROQ_INVALID_KEY: API key invalid. Check GROQ_API_KEY in your .env / GitHub Secrets.");
  if (res.status === 503 || res.status === 502) throw new Error("GROQ_SERVICE_DOWN: Groq is temporarily unavailable. Check status.groq.com.");

  if (res.status === 429) {
    const body       = await res.json().catch(() => ({}));
    const retryAfter = res.headers.get("retry-after") || "60";
    if (body?.error?.message?.includes("daily"))
      throw new Error("GROQ_DAILY_LIMIT: Free tier (1000 req/day) reached. Resets at midnight UTC.");
    throw new Error(`GROQ_RATE_LIMITED: Too many requests. Retry after ${retryAfter}s.`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GROQ_HTTP_${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ── Agentic loop ─────────────────────────────────────────────
// This implements the "ReAct" pattern: the LLM decides what to search for,
// we run the search, feed the results back, and repeat until the model
// stops calling tools and writes the final report.
//
// Iteration flow:
//   1. Send messages → model responds with tool calls ("search for X")
//   2. Run all searches in parallel
//   3. Append results to messages → go back to step 1
//   4. When model responds with no tool calls → it's writing the final report
async function runAgent(label, systemPrompt, userPrompt) {
  // The full conversation: grows each iteration as we add tool results
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userPrompt   },
  ];

  const MAX_ITER    = 14; // safety cap to prevent runaway loops
  let   iter        = 0;
  let   searchCount = 0;

  process.stdout.write(`  [${label}] searching`);

  while (iter < MAX_ITER) {
    iter++;
    const response  = await callGroq(messages);
    const choice    = response.choices?.[0];
    if (!choice) throw new Error("Groq returned empty response.");

    const message   = choice.message;
    const toolCalls = message.tool_calls || []; // functions the model wants to call this turn

    messages.push(message);     // keep the model's message in history
    process.stdout.write(".");  // show progress without newlines

    // No tool calls = model is done searching, final report is in message.content
    if (toolCalls.length === 0 || choice.finish_reason === "stop") {
      process.stdout.write(` done (${searchCount} searches, ${iter} LLM calls)\n`);
      return message.content || "";
    }

    // Run all requested searches in parallel (faster than sequential)
    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        let args;
        try { args = JSON.parse(tc.function.arguments); }
        catch { args = { query: String(tc.function.arguments) }; }

        const raw = await webSearch(args.query);
        searchCount++;

        // If the search errored, surface it in the model's context so it can
        // mention the gap in the report rather than fabricating data
        if (typeof raw === "object" && raw.error) {
          return {
            role:         "tool",
            tool_call_id: tc.id,   // must match the id Groq sent — links result to the right call
            name:         "web_search",
            content:      `⚠️ SEARCH ERROR (${raw.error}): ${raw.message}`,
          };
        }

        return {
          role:         "tool",
          tool_call_id: tc.id,
          name:         "web_search",
          content:      String(raw),
        };
      })
    );

    // Spread adds each result as its own message (required by the tool-use protocol)
    messages.push(...results);
  }

  process.stdout.write(` max-iter reached\n`);
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
  return lastAssistant?.content || "Agent hit iteration limit without producing a final report.";
}

// ── Prompts ──────────────────────────────────────────────────

const MARKET_SYSTEM = `You are a financial intelligence agent for an Indian retail investor.
Search for today's market news using web_search, then write a compact plain-text report.
Rules:
- Call web_search for EVERY topic — do not guess or fabricate any number.
- Be terse. Use abbreviations. Cite sources as (src: domain.com).
- Keep final report under 1200 words.
- If a search returns an error, note it in the report and continue with other searches.`;

const MARKET_USER = `Date: ${TODAY}. Run ALL these searches, then write the report.

SEARCHES:
1. "Sensex Nifty50 today ${TODAY}"
2. "NSE BSE top gainers losers today"
3. "India FII DII data today"
4. "RBI news this week"
5. "India sector news today"
6. "S&P500 Dow Nasdaq today"
7. "Fed interest rate news this week"
8. "crude oil gold price today"
9. "USD INR exchange rate today"
10. "India stocks earnings results this week"
11. "top India stocks to watch this week"
12. "India market risks geopolitical news today"

After ALL searches, write this exact report (fill every field with real data from searches):

============================
MARKET INTELLIGENCE — ${TODAY}
============================

[INDIA MARKET]
Sensex: | Nifty50: | Bank Nifty:
Trend: (bull/bear/sideways + 1 line reason)
FII: | DII:
Drivers:
-
-
-

[GLOBAL PULSE]
S&P500: | Dow: | Nasdaq:
USD/INR: | Crude (WTI): | Gold:
Drivers:
-
-
-

[STOCKS TO WATCH]
(5-8 stocks, TICKER — 1-line reason)
1.
2.
3.
4.
5.

[MACRO SIGNALS]
(2-3 macro events this week affecting markets)
-
-

[RISK RADAR]
(Top 2-3 risks)
-
-

Sources:
============================`;

const TECH_SYSTEM = `You are a senior tech intelligence agent for a Senior Fullstack Engineer (TypeScript/Node.js/React stack).
Search for today's most important tech news using web_search, then write a compact plain-text briefing.
Rules:
- Call web_search for EVERY topic — do not fabricate news.
- Signal over noise. Be terse. Cite as (src: domain.com).
- Keep final report under 1000 words.
- If a search returns an error, note it and continue.`;

const TECH_USER = `Date: ${TODAY}. Run ALL these searches, then write the report.

SEARCHES:
1. "AI LLM new model release ${TODAY}"
2. "OpenAI Anthropic Google AI news this week"
3. "TypeScript JavaScript new release ${TODAY}"
4. "Node.js Bun Deno update this week"
5. "React Next.js update this week"
6. "AWS Azure Google Cloud new features this week"
7. "Docker Kubernetes DevOps news this week"
8. "tech layoffs funding news this week"
9. "India startup tech funding ${TODAY}"
10. "critical CVE security vulnerability this week"
11. "new developer tools libraries ${TODAY}"

After ALL searches, write this exact report:

============================
TECH INTELLIGENCE — ${TODAY}
============================

[AI & LLM]
(Top 3-4 developments, 1-2 lines each)
-
-
-

[WEB & FULLSTACK]
(Top 3 — focus on TS/Node/React ecosystem)
-
-
-

[INFRA & CLOUD]
(Top 2-3 updates)
-
-

[INDUSTRY MOVES]
(Funding, layoffs, acquisitions — 3 bullets)
-
-
-

[SECURITY ALERTS]
(Critical CVEs or breaches — write "None significant" if nothing major)
-

[TOOLS TO TRY]
(1-2 new tools or libs worth checking)
-
-

Sources:
============================`;

// ── Telegram push ─────────────────────────────────────────────
// Sends the report to your phone via Telegram bot.
// Silently skipped if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID are not set.
async function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Telegram has a 4096-char message limit — split into chunks
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) chunks.push(text.slice(i, i + 4000));

  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ chat_id: chatId, text: chunk }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if      (err.error_code === 401)                                          console.error("  ⚠️  Telegram: Invalid bot token. Check TELEGRAM_BOT_TOKEN.");
      else if (err.error_code === 400 && err.description?.includes("chat not found")) console.error("  ⚠️  Telegram: Chat not found. Press START on your bot first.");
      else                                                                      console.error(`  ⚠️  Telegram error ${err.error_code}: ${err.description}`);
      return;
    }
  }
  console.log("  📱 Telegram notification sent.");
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  checkEnv(); // exit early if any required API key is missing

  console.log(`\n🤖 Daily Intelligence Agent v3`);
  console.log(`   Model : Groq / ${GROQ_MODEL} (free tier)`);
  console.log(`   Search: Serper.dev (free tier)`);
  console.log(`   Mode  : ${MODE.toUpperCase()} | Date: ${TODAY}\n`);

  const results = {};

  try {
    if (MODE === "market" || MODE === "both") {
      console.log("📈 Running MARKET agent...");
      results.market = await runAgent("MARKET", MARKET_SYSTEM, MARKET_USER);
    }
    if (MODE === "tech" || MODE === "both") {
      console.log("💻 Running TECH agent...");
      results.tech = await runAgent("TECH", TECH_SYSTEM, TECH_USER);
    }
  } catch (err) {
    // Print the typed error (e.g. GROQ_DAILY_LIMIT) cleanly — no stack trace
    console.error(`\n❌ Agent stopped: ${err.message}\n`);
    if (!results.market && !results.tech) process.exit(1);
  }

  const report = [results.market, results.tech].filter(Boolean).join("\n\n").trim();
  if (!report) {
    console.error("❌ No report generated. Check the errors above.");
    process.exit(1);
  }

  const filename = `${TODAY}-${MODE}.txt`;
  fs.writeFileSync(path.join(OUT_DIR, filename), report);
  console.log(`\n✅ Saved → reports/${filename}`);
  console.log("─".repeat(52));
  console.log(report);
  console.log("─".repeat(52));

  await sendTelegram(report);
}

main().catch((err) => {
  console.error(`\n❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
