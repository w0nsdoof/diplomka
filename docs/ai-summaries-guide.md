# AI Report Summaries — Feature Guide

This feature automatically generates human-readable narrative summaries of your task activity using AI. Summaries help managers quickly understand what happened during a period without digging through individual tasks.

The LLM integration uses **LiteLLM**, a provider-agnostic proxy — the underlying model is swappable without code changes. The current default is **Minimax M2.5** via OpenRouter. Admins can add other models (OpenAI, Anthropic, Groq, Google, etc.) and managers can choose which model to use per request.

## Who can use it?

- **Managers** — full access: view, generate on demand, regenerate, choose LLM model
- **Engineers** — read-only: can view summaries and history, but cannot generate or regenerate
- **Clients** — no access

## What happens automatically

- **Daily summary** — generated every day at 00:05 UTC covering the previous day's task activity
- **Weekly summary** — generated every Monday at 06:00 UTC covering the previous Mon–Sun, including week-over-week trend comparisons

These appear automatically — no action needed.

## How to view summaries

1. Log in as a manager or engineer
2. Go to **Reports** in the sidebar
3. The latest daily and weekly summaries are shown at the top of the page (once generated)
4. Click **"View Summary History"** to see all past summaries

## How to generate a summary on demand

1. Go to **Reports**
2. In the **"Generate AI Summary"** section, pick a **Start Date** and **End Date**
3. Optionally narrow the scope:
   - **Project** — only include tasks from a specific project
   - **Client** — only include tasks for a specific client
   - **Focus prompt** — free-text instructions to tailor the summary (e.g. "Focus on the billing team's workload")
4. Optionally select a different **LLM model** from the dropdown (if multiple models are configured)
5. Click **"Generate AI Summary"**
6. A real-time progress bar shows the pipeline stages (collecting metrics, building prompt, calling LLM, parsing sections)
7. A notification appears when the summary is ready

## How to view summary history

1. Go to **Reports** > **View Summary History** (or navigate to `/reports/summaries`)
2. You'll see a table of all past summaries with:
   - Period dates
   - Type (Daily, Weekly, On-demand)
   - Status (Completed, Pending, Failed)
   - Method (AI or Fallback)
   - Preview of the summary text
3. Use the filter buttons (All / Daily / Weekly / On-demand) to narrow results
4. Click any row to see the full summary

## Summary detail page

Each summary detail page includes:
- **Structured sections** — Overview, Key Metrics, Highlights, Risks & Blockers, Recommendations (daily summaries use a shorter 2-section format: Overview + Watchlist)
- **Charts** — status distribution (doughnut), priority distribution (bar), engineer workload (stacked bar), client activity (bar) — built from the raw metrics data
- **Generation metadata** — which LLM model was used, token usage, generation time
- **Prompt panel** (expandable) — the full prompt that was sent to the LLM
- **Version history** — each regeneration creates a new version; switch between versions from the sidebar

## How to regenerate a summary

If you want a fresh AI take on the same period:

1. Open any summary detail page
2. Optionally select a different **LLM model** from the dropdown
3. Click the **"Regenerate"** button
4. A new version is created — the old one is kept in the **Version History** panel on the right

## Notifications

When a summary is generated (daily, weekly, or on-demand), all managers receive:
- **In-app notification** — click the bell icon in the top-right; clicking a summary notification navigates to that summary
- **Telegram notification** — if the manager has linked their Telegram account, they receive a push message with the summary title and period (bilingual: English or Russian based on user language preference)

## What if the AI is unavailable?

If the LLM service is down, the system automatically generates a **fallback summary** — a structured template with the raw numbers (tasks created, completed, overdue, etc.). You can regenerate it later with AI once the service is back. Fallback summaries are marked with a "Fallback" badge.

## What data is included?

Summaries cover:
- Total tasks, created/completed/overdue in the period (with new vs inherited overdue breakdown)
- Lead time (created to done) and cycle time (in_progress to done) — median, p90, average
- Status and priority distributions
- Top clients by task activity
- Top engineers by workload (assigned, done, in progress, overdue)
- Top tags
- Tasks stuck in "waiting" for 3+ days (named by title)
- Tasks approaching deadline within 48 hours (named by title)
- Status transitions in the period (e.g. created -> in_progress count)
- For weekly: week-over-week comparison (deltas > 20% are highlighted)

## LLM model management (admins)

Admins can manage available LLM models via the admin API:
- **Add models** — any LiteLLM-compatible model identifier (e.g. `openrouter/google/gemini-2.5-flash`, `groq/llama-3.1-8b-instant`, `openai/gpt-4o`)
- **Set a system-wide default** — used when no org or request override is specified
- **Per-organization default** — each org can have its own default model
- **Per-request override** — managers can pick a model when generating or regenerating

Resolution order: request override > org default > system default > `LLM_MODEL` env var.

## Configuration (for admins)

The LLM provider is configured via environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_MODEL` | LiteLLM model identifier (fallback if no DB models configured) | `minimax/minimax-m2.5:free` |
| `LLM_API_KEY` | API key for the LLM provider | (empty) |
| `LLM_API_BASE` | Custom API base URL (for self-hosted or proxy endpoints) | (empty) |
| `LLM_MAX_TOKENS` | Max output tokens | `2000` |
| `LLM_TEMPERATURE` | Generation temperature (daily overrides to 0.1 for consistency) | `0.3` |

LiteLLM supports 100+ providers — see [LiteLLM docs](https://docs.litellm.ai/docs/providers) for model identifier formats.

## Quick test after deployment

1. Log in as `manager@example.com`
2. Go to **Reports**
3. Set Start Date to a week ago, End Date to today
4. Click **"Generate AI Summary"**
5. Watch the real-time progress bar as it moves through pipeline stages
6. Once complete, review the structured sections and charts
7. Try the **"Regenerate"** button with a different LLM model to create a new version
8. Check the bell icon for the in-app notification
