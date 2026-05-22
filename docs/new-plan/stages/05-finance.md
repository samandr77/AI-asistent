# Stage 05 - Finance

## Goal

Create a personal finance module that works through a fast dashboard, manual input, CSV/import-first data loading, documents, subscriptions, budgets, accounts, and conversational AI. Telegram Mini App ships first; backend contracts must stay reusable for native mobile later.

## V1 Scope

- Dashboard: total balance, monthly income, monthly expense, cash flow, remaining budget, net worth, top categories, upcoming payments, goals, recent transactions, alerts.
- Transactions: income, expense, and transfer entries with account/target account, category, merchant, note, date, source, recurring flag, search, filters, and balance updates.
- Categories: preset and custom finance categories with parent/subcategory, icon, color, archive state, and merchant categorization rules.
- Auto-categorization: merchant-pattern rules first; user corrections create or refresh rules. ML/Open Banking enrichment is later.
- Accounts: cash, cards, checking, savings, investment, loan, and other account balances in one view.
- Budgets/envelopes: category limits, allocated amount, spent, remaining, 80% warning, overrun, and rollover carryover.
- Goals: target amount, saved amount, deadline, linked account, status, and contribution advice.
- Subscriptions: active recurring payments, monthly total, next charge, detection by merchant + amount + interval, and due alerts.
- Analytics: category distribution, daily expenses, income/expense/cash flow, period comparison, and month-end forecast from the last 3 months.
- Debts: balance, type, rate, monthly payment, next payment, payoff plan, and amortization schedule.
- Assets/net worth: assets, debts, account balances, net worth history, and projection.
- Income: sources, categories, dates, and monthly comparison.
- Taxes/documents: events, receipt/document records, upload, deductible candidates, and safety wording.
- AI finance assistant: chat plus text intake such as "потратил 1200 на такси" -> analyze actions -> confirm -> write rows. No trusted financial automation without confirmation.
- CSV import: preview, validation, categorization rules, duplicate detection, confirm. Real bank sync stays in Stage 07.

## Later Scope

- Real bank sync through Open Banking, Plaid, Salt Edge, or country-specific adapters.
- Shared/family budget roles and permissions beyond a placeholder contract.
- Multi-currency conversion, investment market pricing, tax filing automation, and professional advice.

## Acceptance Criteria

- Manual, AI-confirmed, receipt/document, and CSV entry work before bank integrations.
- Transfers update account balances and do not count as income or expense in analytics.
- Budget envelopes show spent, remaining, rollover, warning, and overrun states.
- Forecast uses recent historical category spend and flags likely budget overruns.
- Merchant corrections are remembered through categorization rules.
- Finance, tax, debt, and investment outputs include guidance/safety framing and do not pretend to be professional advice.
