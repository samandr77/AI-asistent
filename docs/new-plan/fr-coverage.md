# AI Life OS Coverage Matrix

This matrix tracks every requirement from the source docs and where it is decomposed for implementation.

## Source Documents

| Source | Status | Covered By |
| --- | --- | --- |
| `logic.md` | Mapped | Stages 00, 01, 07, 08, 09 |
| `center-upravlenia.md` | Mapped | Stages 02, 06, 07, 08 |
| `tasks-source.md` | Mapped | Stages 03, 06, 07, 08 |
| `health.md` | Mapped | Stages 04, 07, 08 |
| `finance.md` | Mapped | Stages 05, 07, 08 |
| `avto.md` | Mapped | Stages 06, 07, 08 |

## Functional Requirements

| ID | Requirement | Stage | Task Range | Evidence Needed |
| --- | --- | --- | --- | --- |
| FR-001 | Adaptive onboarding with 5-7 questions, life priorities, profile setup, and conversational training | 00, 08, 09 | T000-T099, T800-T899, T900-T999 | Onboarding UI tests, profile persistence tests |
| FR-002 | Integrations hub for wearable, finance, calendar, messenger, task, and document sources | 01, 07 | T100-T199, T700-T799 | Connector contract tests, manual fallback QA |
| FR-003 | My Life Setup with life domain weights and active sections | 00, 01, 02 | T000-T299 | Domain model tests, dashboard render tests |
| FR-004 | Baseline assessment across sleep, spending, activity, and psychological state | 04, 05, 08 | T400-T599, T800-T899 | Baseline calculation tests |
| FR-005 | Privacy, export, deletion, access control, and local-first control expectations | 01, 10 | T100-T199, T1000-T1099 | Security review, deletion/export tests |
| FR-006 | Main Control Center dashboard with top priorities, goals, health, finance, tasks, and events | 02 | T200-T299 | Dashboard API and UI tests |
| FR-007 | OKR hierarchy from life goals to yearly, quarterly, weekly, and daily work | 02, 03 | T200-T399 | Goal/task linking tests |
| FR-008 | Strategic planning with mission, values, life areas, SWOT, and course drift warnings | 02, 08 | T200-T299, T800-T899 | Strategy data tests, AI recommendation tests |
| FR-009 | Personal KPI tracker with 5-10 metrics, trends, correlations, and anomaly alerts | 02, 06 | T200-T299, T600-T699 | KPI aggregation tests |
| FR-010 | Daily and weekly review with completed tasks, OKR progress, inbox cleanup, reflection, and next plan | 02, 03 | T200-T399 | Review flow tests |
| FR-011 | Energy and productivity planning using sleep, HRV, activity, chronotype, and peak hours | 02, 04, 08 | T200-T499, T800-T899 | Energy score tests |
| FR-012 | Knowledge base and second brain capture with PARA, Zettelkasten links, graph, and search | 01, 08 | T100-T199, T800-T899 | Search/RAG tests |
| FR-013 | Quick task capture by text, voice, browser, messenger, and email inputs | 03, 07, 09 | T300-T399, T700-T799, T900-T999 | Capture tests |
| FR-014 | NLP task parsing for date, time, contact, context, reminder, and ambiguity follow-up | 03, 08 | T300-T399, T800-T899 | Parser tests |
| FR-015 | Inbox processing with AI suggested project, priority, date, 2-minute rule, delegate, delete | 03 | T300-T399 | Inbox workflow tests |
| FR-016 | Eisenhower priority matrix and Big Three daily limit | 03 | T300-T399 | Priority UI tests |
| FR-017 | Time blocking with calendar slots, planning fallacy correction, deep work blocks, and overload warning | 03, 07 | T300-T399, T700-T799 | Calendar/time-block tests |
| FR-018 | Pomodoro and focus mode with session stats, task link, notifications, and break state | 03, 06 | T300-T399, T600-T699 | Timer tests |
| FR-019 | Projects, subtasks, checklists, dependencies, templates, progress, archive | 03 | T300-T399 | Project tests |
| FR-020 | Recurring tasks and habits with flexible rules, rollover, chains, context conditions, stats | 03 | T300-T399 | Recurrence tests |
| FR-021 | Contexts, tags, smart filters, AND/OR saved filters, geo/context suggestions | 03, 07 | T300-T399, T700-T799 | Filter tests |
| FR-022 | Collaboration and delegation with assignees, notifications, comments, files, statuses, mentions | 03 | T300-T399 | Collaboration contract tests |
| FR-023 | Productivity analytics with completion, load, patterns, punctuality, estimate vs actual, weekly report | 03, 06 | T300-T399, T600-T699 | Analytics tests |
| FR-024 | Health dashboard with score, 7/30/90-day trends, activity rings, and quick navigation | 04 | T400-T499 | Health dashboard tests |
| FR-025 | Sleep and recovery tracking with phases, factors, smart alarm planning, and 30-day trends | 04 | T400-T499 | Sleep model tests |
| FR-026 | Activity, workouts, movement reminders, strength logs, readiness, plans, and PRs | 04 | T400-T499 | Activity/workout tests |
| FR-027 | Nutrition, barcode/photo food input, water, micronutrients, glycemic index, fasting, meal plan | 04, 07 | T400-T499, T700-T799 | Nutrition/OCR tests |
| FR-028 | HRV, pulse, SpO2, breathing, stress, mood, meditation, and breathing exercises | 04 | T400-T499 | Biomarker tests |
| FR-029 | Weight, body composition, metabolism, labs, pressure, sugar, cholesterol, medications, visits | 04 | T400-T499 | Medical record tests |
| FR-030 | Optional menstrual cycle and reproductive health module | 04 | T400-T499 | Optional module tests |
| FR-031 | AI health insights with personal baseline, cross-metric correlations, and doctor summary | 04, 08 | T400-T499, T800-T899 | Insight safety tests |
| FR-032 | Finance dashboard with balances, monthly spend, remaining budget, net worth, transactions, alerts | 05 | T500-T599 | Finance dashboard tests |
| FR-033 | Transactions with categorization, manual edit, notes, filters, search, income/expense split | 05 | T500-T599 | Transaction tests |
| FR-034 | Monthly budget with category limits, daily/monthly views, alerts, rollover, redistribution, templates | 05 | T500-T599 | Budget tests |
| FR-035 | Financial goals and savings with amount, date, account link, monthly contribution advice | 05 | T500-T599 | Savings tests |
| FR-036 | Subscriptions and recurring payments with detection, next charge, reminders, monthly total | 05, 06 | T500-T699 | Subscription tests |
| FR-037 | Finance analytics with category charts, comparisons, cash flow, trends, periods | 05 | T500-T599 | Report tests |
| FR-038 | Debts and credits with balance, rate, payment, next date, payoff calculator, schedule | 05 | T500-T599 | Debt tests |
| FR-039 | Investments, assets, asset allocation, dividends, ROI, and portfolio growth | 05 | T500-T599 | Asset tests |
| FR-040 | Net worth with assets minus debts, history, and 5-year projection | 05 | T500-T599 | Net worth tests |
| FR-041 | AI finance assistant with chat entry, anomaly detection, savings advice, receipt photo input | 05, 08 | T500-T599, T800-T899 | Finance AI tests |
| FR-042 | Income tracking and tax/documents calendar with deductions and receipt storage | 05, 07 | T500-T599, T700-T799 | Income/tax tests |
| FR-043 | Automation scenarios with time, event, context triggers and no-code scenario model | 06 | T600-T699 | Trigger engine tests |
| FR-044 | Autonomous AI agent using plan, execute, verify, and result confirmation loop | 06, 08 | T600-T899 | Agent tests |
| FR-045 | Routine and habit automation with morning, evening, weekly templates and adaptive reminders | 06 | T600-T699 | Routine tests |
| FR-046 | Digital focus automation with distraction patterns, notification filtering, and focus protections | 03, 06 | T300-T399, T600-T699 | Focus tests |
| FR-047 | Proactive assistant suggestions before meetings, deadlines, missed habits, finance/health anomalies | 02, 06, 08 | T200-T899 | Proactive recommendation tests |
| FR-048 | Autonomous reports for weekly/monthly summaries and anomaly monitoring | 06 | T600-T699 | Report generation tests |
| FR-049 | Communication automation with message classification, reply drafts, style memory, channel integrations | 06, 07, 08 | T600-T899 | Communication safety tests |
| FR-050 | Self-learning personalization with feedback, preferences, rhythms, style, and frequency adaptation | 08 | T800-T899 | Feedback loop tests |
| FR-051 | Permission levels for autonomy: autonomous, semi-autonomous, consultative, with full action log | 01, 06, 10 | T100-T199, T600-T699, T1000-T1099 | Audit and permission tests |
| FR-052 | Telegram Mini App route delivery for all modules with loading, empty, error, offline, and responsive states | 09 | T900-T999 | UI tests and manual QA |

## Open Evidence

- Manual real-device Telegram QA remains open until run on iOS, Android, and Desktop.
- External integrations that require vendor credentials must have manual fallback paths before first release.
- Health, tax, legal, and investment recommendations require disclaimer and safety review before release.
