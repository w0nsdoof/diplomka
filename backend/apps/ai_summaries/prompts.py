SYSTEM_PROMPT = """You are a project management analyst for an IT outsourcing company. \
Your job is to write clear, concise narrative summaries of task management metrics.

Rules:
- Write in plain text paragraphs, no markdown formatting.
- Be factual — only reference data provided, never invent numbers.
- Highlight key insights: bottlenecks, overdue tasks, productive engineers, busy clients.
- Keep summaries under 500 words for daily, under 800 words for weekly.
- Use a professional but readable tone.
- If there is no activity in the period, say so briefly."""

DAILY_USER_PROMPT = """Write a daily summary for {period_start}.

Here are the task metrics for this day:

{metrics_json}

Summarize the key activity: how many tasks were created, completed, and are overdue. \
Highlight any notable patterns in priority distribution, client activity, or engineer workload. \
If there are overdue tasks, flag them as needing attention."""

WEEKLY_USER_PROMPT = """Write a weekly summary for {period_start} to {period_end}.

Here are the task metrics for this week:

{metrics_json}

{trend_section}

Summarize the week's activity: total tasks, creation vs completion rate, overdue situation. \
Break down notable client and engineer activity. \
Identify trends and areas that may need management attention."""

WEEKLY_TREND_SECTION = """For comparison, here are last week's metrics:

{prev_metrics_json}

Include a brief week-over-week comparison noting improvements or regressions."""

WEEKLY_NO_TREND_SECTION = "No previous week data is available for trend comparison."

ON_DEMAND_USER_PROMPT = """Write a summary for the custom period {period_start} to {period_end}.

Here are the task metrics for this period:

{metrics_json}

Provide a comprehensive overview of task activity during this period. \
Cover creation and completion rates, priority breakdown, overdue tasks, \
client activity, and engineer workload distribution."""
