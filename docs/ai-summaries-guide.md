# AI Report Summaries — Feature Guide

This feature automatically generates human-readable narrative summaries of your task activity using AI. Summaries help managers quickly understand what happened during a period without digging through individual tasks.

## Who can use it?

Only **managers** have access to AI summaries. Engineers and clients won't see these features.

## What happens automatically

- **Daily summary** — generated every day at 00:05 UTC covering the previous day's task activity
- **Weekly summary** — generated every Monday at 06:00 UTC covering the previous Mon–Sun, including week-over-week trend comparisons

These appear automatically — no action needed.

## How to view summaries

1. Log in as a manager
2. Go to **Reports** in the sidebar
3. The latest daily and weekly summaries are shown at the top of the page (once generated)
4. Click **"View Summary History"** to see all past summaries

## How to generate a summary on demand

1. Go to **Reports**
2. In the **"Generate AI Summary"** section, pick a **Start Date** and **End Date**
3. Click **"Generate AI Summary"**
4. A notification will appear when the summary is ready (usually takes a few seconds)

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

## How to regenerate a summary

If you want a fresh AI take on the same period:

1. Open any summary detail page
2. Click the **"Regenerate"** button
3. A new version is created — the old one is kept in the **Version History** panel on the right

## Notifications

When a summary is generated (daily, weekly, or on-demand), all managers receive an in-app notification. Click the bell icon in the top-right to see them. Clicking a summary notification takes you directly to that summary.

## What if the AI is unavailable?

If the LLM service is down, the system automatically generates a **fallback summary** — a structured template with the raw numbers (tasks created, completed, overdue, etc.). You can regenerate it later with AI once the service is back. Fallback summaries are marked with a "Fallback" badge.

## What data is included?

Summaries cover:
- Total tasks, created/completed/overdue in the period
- Priority breakdown (low, medium, high, critical)
- Client activity (tasks per client)
- Engineer workload (tasks per engineer)
- For weekly: comparison with the previous week's numbers

## Configuration (for admins)

The LLM provider is configured via environment variables in `.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `LLM_MODEL` | LiteLLM model identifier | `groq/llama-3.1-8b-instant` |
| `LLM_API_KEY` | API key (or use provider-specific like `GROQ_API_KEY`) | `sk-...` |
| `LLM_MAX_TOKENS` | Max output tokens (default: 2000) | `2000` |
| `LLM_TEMPERATURE` | Generation temperature (default: 0.3) | `0.3` |

Supported providers include OpenAI, Anthropic, Groq, Azure, and any OpenAI-compatible API.

## Quick test after deployment

1. Log in as `manager@example.com`
2. Go to **Reports**
3. Set Start Date to a week ago, End Date to today
4. Click **"Generate AI Summary"**
5. Wait a few seconds, then check the bell icon for a notification
6. Click the notification — you should see the full AI-generated summary
7. Try the **"Regenerate"** button to create a new version
