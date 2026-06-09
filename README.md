DAILY INTELLIGENCE AGENT v3 — COMPLETE SETUP GUIDE
====================================================
100% free. No credit card. Runs on GitHub while your laptop is off.

VERIFIED FREE TIERS (June 2026)
--------------------------------
Service          Free allowance          Card needed?
-----------      -------------------     ------------
Groq             1000 req/day, 100K      NO
                 tokens/day, 30 RPM
Serper.dev       2500 total queries      NO
Telegram Bot     Unlimited messages      NO
GitHub Actions   2000 minutes/month      NO (need GitHub account)

Your daily usage: ~15 Groq calls + ~12 Serper searches per run.
Serper 2500 free queries = ~200 days of free daily runs.


FILES IN THIS FOLDER
---------------------
agent.js                        main script (zero npm dependencies)
package.json                    run scripts
.env.example                    copy to .env, fill in keys
.github/
  workflows/
    daily.yml                   GitHub Actions automation


════════════════════════════════════════════════════
STEP 1 — GET YOUR FREE API KEYS
════════════════════════════════════════════════════

Both are genuinely free. No credit card. Takes ~10 minutes total.

─── A. Groq API key (the LLM brain) ────────────────
1. Open: https://console.groq.com
2. Click "Sign Up" — use Google or email
3. Verify your email if prompted
4. In the dashboard, click "API Keys" in the left sidebar
5. Click "Create API Key"
6. Give it a name: "daily-agent"
7. Copy the key — looks like: gsk_xxxxxxxxxxxxxxxxxxxx
   ⚠️  Save it now — Groq only shows it once

─── B. Serper API key (Google search) ──────────────
1. Open: https://serper.dev
2. Click "Get Started" or "Sign Up"
3. Sign in with Google (fastest) or email
4. You land on the dashboard — your API key is shown on the main page
5. Copy it — looks like: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ✅ 2500 free queries are credited automatically, no card needed
   ℹ️  When free queries run out, you see an error in the agent output
       with instructions. You can top up at $50 for 50K queries,
       or create a new account for another 2500 free.

─── C. Telegram bot (phone notifications) ──────────
   Optional. Skip if you only want to read reports in GitHub Actions.

1. Open Telegram on your phone
2. Search for: @BotFather
3. Tap "Start" then send: /newbot
4. When asked for a name, type: Daily Intel
5. When asked for username, type something unique: myintel_2025_bot
6. BotFather replies with your token:
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Save this as TELEGRAM_BOT_TOKEN

7. Search for: @userinfobot in Telegram
8. Tap "Start" — it replies with your numeric ID like: 987654321
   Save this as TELEGRAM_CHAT_ID

9. Search your new bot by username → tap it → press "Start"
   (This one-time step lets the bot send you messages)


════════════════════════════════════════════════════
STEP 2 — LOCAL SETUP AND TEST
════════════════════════════════════════════════════

Requirements: Node.js v18 or higher
Check: node -v
Install Node if needed: https://nodejs.org (LTS version)

No npm install needed — agent uses only built-in Node.js APIs.

─── 2a. Create your .env file ──────────────────────
In the project folder, copy the template:
   cp .env.example .env

Open .env in any text editor and fill in your keys:

   GROQ_API_KEY=gsk_your_actual_key_here
   SERPER_API_KEY=your_actual_serper_key_here

   # Optional — for Telegram:
   # TELEGRAM_BOT_TOKEN=7123456789:AAHxxx
   # TELEGRAM_CHAT_ID=987654321

Save the file.

─── 2b. Run the agent ──────────────────────────────

   node agent.js both      ← market + tech (recommended)
   node agent.js market    ← market briefing only
   node agent.js tech      ← tech briefing only

You'll see output like:
   🤖 Daily Intelligence Agent v3
      Model : Groq / llama-3.3-70b-versatile (free tier)
      Search: Serper.dev (free tier)
      Mode  : BOTH | Date: 2025-06-09

   📈 Running MARKET agent...
     [MARKET] searching......... done (12 searches, 14 LLM calls)
   💻 Running TECH agent...
     [TECH] searching........ done (11 searches, 12 LLM calls)

   ✅ Saved → reports/2025-06-09-both.txt

The full report prints to terminal and saves to the reports/ folder.
If Telegram is configured, report arrives on your phone.

─── 2c. Error messages you might see ──────────────

If a key is missing or wrong, agent stops immediately with:
   ❌ MISSING API KEYS — agent cannot start.
   Add these to your .env file:
     GROQ_API_KEY   — get free at console.groq.com (no card)
     SERPER_API_KEY — get free at serper.dev (no card, 2500 queries)

If Serper free queries are used up:
   ⚠️ SEARCH ERROR (SERPER_FREE_TIER_EXHAUSTED):
   Serper free tier (2500 queries) is exhausted.
   Visit serper.dev to top up ($50 for 50K queries) or create
   a new account for another 2500 free queries.
   → The agent continues with remaining searches and writes a
     partial report with whatever data it could collect.

If Groq daily limit is hit (1000 requests/day):
   ❌ Agent stopped: GROQ_DAILY_LIMIT: Groq free tier daily limit
   (1000 requests/day) reached. Resets at midnight UTC.
   Try again tomorrow, or add a card at console.groq.com for
   10x limits (still free to upgrade).
   → In practice you use ~27 Groq calls per "both" run,
     so you'd need to run it 37 times in one day to hit this.
     It will not happen in normal daily use.

If Groq rate limit is hit (30 requests/minute):
   ❌ GROQ_RATE_LIMITED: Too many requests. Retry after 60s.
   → If this ever happens, just re-run the agent after a minute.


════════════════════════════════════════════════════
STEP 3 — PUSH TO GITHUB
════════════════════════════════════════════════════

─── 3a. Create a GitHub repository ─────────────────
1. Go to https://github.com
2. Click the "+" icon (top right) → "New repository"
3. Repository name: daily-intelligence
4. Set to: Private (recommended — keep your workflow private)
5. Leave "Initialize this repository" UNCHECKED
6. Click "Create repository"

─── 3b. Push your code ─────────────────────────────
Open terminal in your project folder and run these commands
one by one:

   git init
   git add agent.js package.json .env.example
   git add .github/
   echo ".env" > .gitignore
   echo "reports/" >> .gitignore
   git add .gitignore
   git commit -m "Initial: daily intelligence agent v3"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/daily-intelligence.git
   git push -u origin main

Replace YOUR_USERNAME with your actual GitHub username.

─── 3c. Add secrets to GitHub ───────────────────────
Your API keys go into GitHub Secrets. They are encrypted —
no one (including GitHub staff) can read them.

1. Go to your repo page on GitHub
2. Click the "Settings" tab (last tab, top of page)
3. Left sidebar: scroll to "Security" section
4. Click "Secrets and variables" → "Actions"
5. Click "New repository secret" for each key:

   Secret 1:
     Name:  GROQ_API_KEY
     Value: gsk_your_actual_groq_key
     → Click "Add secret"

   Secret 2:
     Name:  SERPER_API_KEY
     Value: your_actual_serper_key
     → Click "Add secret"

   Secret 3 (if using Telegram):
     Name:  TELEGRAM_BOT_TOKEN
     Value: 7123456789:AAHyour_token
     → Click "Add secret"

   Secret 4 (if using Telegram):
     Name:  TELEGRAM_CHAT_ID
     Value: 987654321
     → Click "Add secret"

You should now see 2-4 secrets listed (names visible, values hidden).


════════════════════════════════════════════════════
STEP 4 — TEST THE GITHUB AUTOMATION
════════════════════════════════════════════════════

Don't wait until tomorrow to test. Trigger a manual run now:

1. Click the "Actions" tab in your repo
2. In the left panel, click "Daily Intelligence Agent"
3. Click the "Run workflow" dropdown (right side)
4. Select mode: "both"
5. Click "Run workflow" (green button)

Watch it run:
- Click the workflow run that appears
- Click the "run" job
- See live logs as searches happen

When done (2-4 minutes):
- Scroll down to "Artifacts" section
- Click "report-XXXXXXXXXX" to download your .txt report
- Check your Telegram if you configured it

If it works here, it will work every day automatically.


════════════════════════════════════════════════════
STEP 5 — AUTOMATIC DAILY SCHEDULE
════════════════════════════════════════════════════

The workflow in .github/workflows/daily.yml is set to run at:
   cron: '0 2 * * *'   →   7:30 AM IST every day

No action needed — this runs automatically once the workflow
file is in your repo (which you pushed in Step 3b).

To change the time, edit daily.yml line 5:
   cron: '0 2 * * *'   = 7:30 AM IST daily
   cron: '30 2 * * *'  = 8:00 AM IST daily
   cron: '0 2 * * 1-5' = 7:30 AM IST weekdays only
   cron: '0 4 * * *'   = 9:30 AM IST daily

Converter: https://crontab.guru

⚠️  GitHub pauses scheduled workflows if the repo has no activity
for 60 days. To keep it active, push any small commit
(e.g. edit a README) once every 2 months.


════════════════════════════════════════════════════
QUICK REFERENCE — WHAT EACH ERROR MEANS
════════════════════════════════════════════════════

Error code                   What happened            What to do
---------------------------  -----------------------  ---------------------------
GROQ_INVALID_KEY             Wrong key in secret      Re-check GROQ_API_KEY value
GROQ_DAILY_LIMIT             1000 req/day used up     Wait until midnight UTC
GROQ_RATE_LIMITED            30 req/min exceeded      Wait 60 sec, retry
GROQ_SERVICE_DOWN            Groq servers down        Check status.groq.com
SERPER_INVALID_KEY           Wrong key in secret      Re-check SERPER_API_KEY value
SERPER_FREE_TIER_EXHAUSTED   2500 queries used up     New account or pay $50
SERPER_RATE_LIMITED          Too many searches/min    Wait 60 sec, retry
SERPER_NETWORK_ERROR         DNS/internet failure     Check internet / GitHub status


════════════════════════════════════════════════════
WHEN FREE TIERS RUN OUT — YOUR OPTIONS
════════════════════════════════════════════════════

Serper (most likely to run out first):
  Option A: Create a new free Serper account (another 2500 queries)
  Option B: Pay $50 once → 50,000 queries → ~11 years at daily use
  Option C: Switch to Tavily free tier (1000 searches, no card):
            Change SERPER_API_KEY to TAVILY_API_KEY and update
            the webSearch() function URL in agent.js

Groq (very unlikely to hit daily limit with normal use):
  Option A: Wait until midnight UTC — resets daily
  Option B: Add a credit card at console.groq.com for 10x limits
            (you are NOT charged — the upgrade itself is free)
  Option C: Switch model to llama-3.1-8b-instant (higher free limits)
            Change GROQ_MODEL in agent.js line 22

====================================================
