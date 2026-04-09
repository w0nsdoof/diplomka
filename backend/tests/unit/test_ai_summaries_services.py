from apps.ai_summaries.services import (
    _build_user_prompt,
    anonymize_metrics,
    compute_deltas,
    deanonymize_text,
    generate_fallback_summary,
    parse_sections,
    render_deltas_as_markdown,
    render_metrics_as_markdown,
)


class TestParseSections:
    def test_parses_standard_sections(self):
        text = (
            "## Overview\nSome overview text.\n\n"
            "## Key Metrics\nMetric details.\n\n"
            "## Highlights\nHighlights here."
        )
        sections = parse_sections(text)
        assert sections["Overview"] == "Some overview text."
        assert sections["Key Metrics"] == "Metric details."
        assert sections["Highlights"] == "Highlights here."

    def test_no_sections_falls_back_to_overview(self):
        text = "Just a plain text summary with no headers."
        sections = parse_sections(text)
        assert sections == {"Overview": text}

    def test_empty_text(self):
        sections = parse_sections("")
        assert sections == {"Overview": ""}

    def test_preserves_multiline_content(self):
        text = "## Overview\nLine 1\nLine 2\nLine 3\n\n## Risks & Blockers\nRisk info."
        sections = parse_sections(text)
        assert "Line 1\nLine 2\nLine 3" in sections["Overview"]
        assert sections["Risks & Blockers"] == "Risk info."


class TestAnonymizeMetrics:
    def test_replaces_client_and_engineer_names(self):
        metrics = {
            "by_client": [
                {"client_name": "Acme Corp", "total": 10, "done": 5},
                {"client_name": "Widgets Inc", "total": 3, "done": 1},
            ],
            "by_engineer": [
                {"engineer_name": "John Smith", "assigned": 8, "done": 4},
                {"engineer_name": "Jane Doe", "assigned": 5, "done": 3},
            ],
        }
        [anon], reverse_map = anonymize_metrics(metrics)

        assert anon["by_client"][0]["client_name"] == "Client A"
        assert anon["by_client"][1]["client_name"] == "Client B"
        assert anon["by_engineer"][0]["engineer_name"] == "Engineer 1"
        assert anon["by_engineer"][1]["engineer_name"] == "Engineer 2"

        assert reverse_map["Client A"] == "Acme Corp"
        assert reverse_map["Engineer 2"] == "Jane Doe"

    def test_does_not_mutate_original(self):
        metrics = {
            "by_client": [{"client_name": "Acme Corp", "total": 1, "done": 0}],
            "by_engineer": [],
        }
        anonymize_metrics(metrics)
        assert metrics["by_client"][0]["client_name"] == "Acme Corp"

    def test_empty_lists(self):
        metrics = {"by_client": [], "by_engineer": []}
        [anon], reverse_map = anonymize_metrics(metrics)
        assert anon == metrics
        assert reverse_map == {}

    def test_consistent_mapping_across_multiple_metrics(self):
        current = {
            "by_client": [{"client_name": "Acme Corp", "total": 5, "done": 2}],
            "by_engineer": [{"engineer_name": "John Smith", "assigned": 3, "done": 1}],
        }
        previous = {
            "by_client": [
                {"client_name": "Acme Corp", "total": 3, "done": 1},
                {"client_name": "NewCo", "total": 1, "done": 0},
            ],
            "by_engineer": [{"engineer_name": "John Smith", "assigned": 2, "done": 1}],
        }
        [anon_curr, anon_prev], reverse_map = anonymize_metrics(current, previous)

        # Same name should get the same pseudonym across both.
        assert anon_curr["by_client"][0]["client_name"] == anon_prev["by_client"][0]["client_name"]
        assert anon_curr["by_engineer"][0]["engineer_name"] == anon_prev["by_engineer"][0]["engineer_name"]

        # NewCo only in prev should still be mapped.
        assert anon_prev["by_client"][1]["client_name"] == "Client B"

    def test_handles_none_metrics(self):
        [result], reverse_map = anonymize_metrics(None)
        assert result is None
        assert reverse_map == {}


class TestDeanonymizeText:
    def test_restores_names(self):
        reverse_map = {"Client A": "Acme Corp", "Engineer 1": "John Smith"}
        text = "Client A had 10 tasks. Engineer 1 completed 5."
        result = deanonymize_text(text, reverse_map)
        assert result == "Acme Corp had 10 tasks. John Smith completed 5."

    def test_empty_mapping(self):
        text = "No changes needed."
        assert deanonymize_text(text, {}) == text

    def test_longest_first_prevents_partial_replacement(self):
        reverse_map = {
            "Client A": "Alpha Corp",
            "Client AB": "AlphaBeta Corp",
        }
        text = "Client AB had more tasks than Client A."
        result = deanonymize_text(text, reverse_map)
        assert "AlphaBeta Corp" in result
        assert "Alpha Corp" in result


class TestComputeDeltas:
    def test_computes_basic_deltas(self):
        current = {"tasks": {"total": 20, "created_in_period": 10, "closed_in_period": 8, "overdue": 3}}
        prev = {"tasks": {"total": 15, "created_in_period": 12, "closed_in_period": 6, "overdue": 5}}
        deltas = compute_deltas(current, prev)

        assert deltas["total"]["current"] == 20
        assert deltas["total"]["previous"] == 15
        assert deltas["total"]["change"] == 5
        assert deltas["total"]["change_pct"] == 33.3

        assert deltas["overdue"]["change"] == -2

    def test_handles_zero_previous(self):
        current = {"tasks": {"total": 10}}
        prev = {"tasks": {"total": 0}}
        deltas = compute_deltas(current, prev)
        assert deltas["total"]["change_pct"] is None

    def test_handles_missing_keys(self):
        current = {"tasks": {"total": 5}}
        prev = {"tasks": {}}
        deltas = compute_deltas(current, prev)
        assert deltas["total"]["previous"] == 0
        assert deltas["total"]["change"] == 5

    def test_skips_both_none(self):
        current = {"tasks": {}}
        prev = {"tasks": {}}
        deltas = compute_deltas(current, prev)
        assert "avg_resolution_time_hours" not in deltas


def _sample_metrics():
    """A representative metrics dict shaped like reports.services.get_report_data output."""
    return {
        "period": {"from": "2026-04-01", "to": "2026-04-07"},
        "tasks": {
            "total": 42,
            "by_status": {"created": 5, "in_progress": 8, "waiting": 3, "done": 25, "archived": 1},
            "by_priority": {"low": 10, "medium": 20, "high": 8, "critical": 4},
            "created_in_period": 12,
            "closed_in_period": 9,
            "overdue": 4,
            "overdue_new": 2,
            "overdue_inherited": 2,
            "avg_resolution_time_hours": 18.5,
            "unassigned_count": 2,
            "completion_rate": 75.0,
            "stuck_waiting": {
                "count": 2,
                "sample": [
                    {"id": 101, "title": "Migrate auth middleware", "priority": "high", "waiting_hours": 96.0},
                    {"id": 102, "title": "Refactor billing", "priority": "medium", "waiting_hours": 72.0},
                ],
            },
            "lead_time": {"avg_hours": 18.5, "median_hours": 12.0, "p90_hours": 48.0, "count": 9},
            "cycle_time": {"avg_hours": 6.2, "median_hours": 4.5, "p90_hours": 16.0, "count": 9},
            "approaching_deadline": [
                {"id": 201, "title": "Finalize API contracts", "priority": "high", "deadline": "2026-04-08T14:00:00+00:00", "hours_remaining": 11.5},
                {"id": 202, "title": "Ship billing fix", "priority": "critical", "deadline": "2026-04-08T23:00:00+00:00", "hours_remaining": 20.3},
            ],
            "status_transitions": [
                {"from": "created", "to": "in_progress", "count": 8},
                {"from": "in_progress", "to": "done", "count": 5},
                {"from": "in_progress", "to": "waiting", "count": 2},
            ],
        },
        "by_client": [
            {"client_id": 1, "client_name": "Acme Corp", "total": 8, "done": 5},
            {"client_id": 2, "client_name": "Widgets Inc", "total": 4, "done": 2},
        ],
        "by_engineer": [
            {"engineer_id": 1, "engineer_name": "John Smith", "assigned": 6, "done": 4},
            {"engineer_id": 2, "engineer_name": "Jane Doe", "assigned": 3, "done": 1},
        ],
        "by_tag": [
            {"tag_id": 1, "tag_name": "backend", "count": 7},
            {"tag_id": 2, "tag_name": "frontend", "count": 3},
        ],
    }


class TestRenderMetricsAsMarkdown:
    def test_includes_headline_table(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "## Headline numbers" in md
        assert "| Total tasks (all-time, in org) | 42 |" in md
        assert "| Created in period | 12 |" in md
        assert "| Closed in period | 9 |" in md
        assert "| Completion rate | 75.0% |" in md
        assert "| Currently overdue | 4 (2 new this period, 2 inherited) |" in md

    def test_includes_lead_and_cycle_time_with_median_p90(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "median 12.0h" in md
        assert "p90 48.0h" in md
        assert "median 4.5h" in md
        assert "p90 16.0h" in md

    def test_includes_status_and_priority_tables(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "## Status distribution" in md
        assert "| in_progress | 8 |" in md
        assert "## Priority distribution" in md
        assert "| critical | 4 |" in md

    def test_includes_client_engineer_tag_tables_with_real_names(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "Acme Corp" in md
        assert "Widgets Inc" in md
        assert "John Smith" in md
        assert "Jane Doe" in md
        assert "| backend | 7 |" in md
        # Anonymization is gone — these should be the real names.
        assert "Client A" not in md
        assert "Engineer 1" not in md

    def test_includes_stuck_task_sample_with_titles_and_hours(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "Stuck-waiting tasks" in md
        assert "2 total" in md
        assert "Migrate auth middleware" in md
        assert "Refactor billing" in md
        assert "96.0" in md

    def test_handles_empty_metrics_gracefully(self):
        md = render_metrics_as_markdown({})
        assert "Headline numbers" in md  # still renders the headline table with zeros
        assert "Total tasks (all-time, in org) | 0" in md

    def test_handles_none_metrics(self):
        assert "No metrics available" in render_metrics_as_markdown(None)

    def test_omits_breakdown_tables_when_empty(self):
        m = _sample_metrics()
        m["by_client"] = []
        m["by_engineer"] = []
        m["by_tag"] = []
        md = render_metrics_as_markdown(m)
        assert "Top" not in md or "Top 0" not in md
        assert "Acme Corp" not in md

    def test_handles_n_a_for_missing_durations(self):
        m = _sample_metrics()
        m["tasks"]["lead_time"] = {"avg_hours": None, "median_hours": None, "p90_hours": None, "count": 0}
        m["tasks"]["cycle_time"] = None
        md = render_metrics_as_markdown(m)
        assert "Lead time (created → done) | N/A" in md
        assert "Cycle time (in_progress → done) | N/A" in md

    def test_includes_overdue_new_and_inherited(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "2 new this period" in md
        assert "2 inherited" in md

    def test_overdue_without_breakdown_when_none(self):
        m = _sample_metrics()
        m["tasks"]["overdue_new"] = None
        m["tasks"]["overdue_inherited"] = None
        md = render_metrics_as_markdown(m)
        assert "Currently overdue | 4 |" in md
        assert "new this period" not in md

    def test_includes_approaching_deadline_table(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "Approaching deadline (next 48 h): 2 tasks" in md
        assert "Finalize API contracts" in md
        assert "Ship billing fix" in md
        assert "11.5" in md

    def test_approaching_deadline_empty(self):
        m = _sample_metrics()
        m["tasks"]["approaching_deadline"] = []
        md = render_metrics_as_markdown(m)
        assert "Approaching deadline (next 48 h): 0 tasks" in md

    def test_includes_status_transitions_table(self):
        md = render_metrics_as_markdown(_sample_metrics())
        assert "Status transitions in period" in md
        assert "| created | in_progress | 8 |" in md
        assert "| in_progress | done | 5 |" in md

    def test_status_transitions_empty(self):
        m = _sample_metrics()
        m["tasks"]["status_transitions"] = []
        md = render_metrics_as_markdown(m)
        assert "No transitions recorded" in md


class TestRenderDeltasAsMarkdown:
    def test_renders_deltas_table(self):
        deltas = compute_deltas(
            {"tasks": {"total": 20, "created_in_period": 10, "closed_in_period": 8}},
            {"tasks": {"total": 15, "created_in_period": 12, "closed_in_period": 6}},
        )
        md = render_deltas_as_markdown(deltas)
        assert "| Total tasks |" in md
        assert "| Created in period |" in md
        assert "| Closed in period |" in md
        assert "33.3%" in md  # (20-15)/15

    def test_handles_empty(self):
        assert "No previous-period data" in render_deltas_as_markdown({})


class TestBuildUserPrompt:
    def test_daily_prompt_uses_daily_template(self):
        prompt = _build_user_prompt("daily", "2026-04-08", "2026-04-08", _sample_metrics())
        assert "## Overview" in prompt
        assert "## Watchlist" in prompt
        # Daily should NOT have the full 5-section template
        assert "## Recommendations" not in prompt
        assert "Headline numbers" in prompt
        # Zero-activity instruction
        assert "No task activity" in prompt
        # Approaching deadline instruction
        assert "approaching-deadline" in prompt

    def test_weekly_prompt_includes_no_trend_section_when_prev_missing(self):
        prompt = _build_user_prompt("weekly", "2026-04-01", "2026-04-07", _sample_metrics())
        assert "## Recommendations" in prompt
        assert "No previous week data available" in prompt
        assert "Headline numbers" in prompt

    def test_weekly_prompt_includes_trend_section_when_prev_present(self):
        prev = _sample_metrics()
        prev["tasks"]["created_in_period"] = 6
        prompt = _build_user_prompt(
            "weekly", "2026-04-01", "2026-04-07", _sample_metrics(), prev_metrics=prev,
        )
        assert "Week-over-week change" in prompt
        assert "abs(change_pct) > 20" in prompt
        # Markdown delta table content
        assert "| Created in period | 12 | 6 |" in prompt

    def test_on_demand_prompt(self):
        prompt = _build_user_prompt("on_demand", "2026-04-01", "2026-04-07", _sample_metrics())
        assert "## Overview" in prompt
        assert "## Recommendations" in prompt
        assert "Headline numbers" in prompt


class TestFallbackSummary:
    def test_daily_fallback_uses_two_section_shape(self):
        text = generate_fallback_summary("daily", _sample_metrics())
        assert "## Overview" in text
        assert "## Watchlist" in text
        assert "## Recommendations" not in text  # daily does not have recommendations
        assert "Migrate auth middleware" in text  # longest stuck task surfaced

    def test_weekly_fallback_uses_full_shape(self):
        text = generate_fallback_summary("weekly", _sample_metrics())
        for section in ["## Overview", "## Key Metrics", "## Highlights", "## Risks & Blockers", "## Recommendations"]:
            assert section in text
        assert "Acme Corp" in text
        assert "median 12.0h" in text  # lead time formatted

    def test_on_demand_fallback_uses_full_shape(self):
        text = generate_fallback_summary("on_demand", _sample_metrics())
        assert "Custom-period summary" in text
        assert "## Recommendations" in text

    def test_fallback_handles_zero_stuck_tasks(self):
        m = _sample_metrics()
        m["tasks"]["stuck_waiting"] = {"count": 0, "sample": []}
        text = generate_fallback_summary("daily", m)
        assert "No stuck-waiting tasks" in text
