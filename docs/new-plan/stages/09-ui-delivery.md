# Stage 09 - Telegram Mini App UI Delivery

## Goal

Deliver the Life OS modules through Telegram Mini App screens that are fast, dense, readable, and resilient on mobile WebView.

## Screens

- Control Center dashboard, OKR, strategic map, KPI, daily review, weekly review.
- Tasks: capture, inbox, matrix, calendar/time blocks, focus, projects, recurring/habits, filters, analytics.
- Health: dashboard, sleep, activity, workouts, nutrition, biomarkers, stress, weight, labs, meds, cycle, insights.
- Finance: dashboard, transactions, budgets, goals, subscriptions, analytics, debts, assets, net worth, income, taxes, chat.
- Autonomy: scenarios, triggers, routines, permissions, audit log, reports.
- Integrations: connection list, permission state, sync status, manual import.
- AI Memory: profile, preferences, baseline, memory editor, feedback.
- Profile and settings.

## UI Requirements

- Loading, empty, error, offline, permission-needed, and premium-needed states.
- Telegram BackButton support, safe viewport behavior, dark/light themes, keyboard behavior.
- RU/EN localization.
- Dense operational layouts instead of marketing-style pages.
- No card-inside-card layouts.

## Acceptance Criteria

- Core routes render on small Telegram WebView screens without overlapping text.
- Every module can be reached from navigation.
- Manual QA passes on Telegram iOS, Android, and Desktop.
