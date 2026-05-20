# Stage 07 - Integrations And Data Intake

## Goal

Define integration architecture and manual fallbacks so the first release can work without waiting for every external provider.

## Features

- Integration registry with connector state, permission scope, last sync, and failure reason.
- Calendar adapter and manual event fallback.
- Telegram bot input for tasks, health notes, finance records, documents, and quick questions.
- Wearable/health adapter interface for Apple Health, Google Fit, Garmin, Oura, WHOOP.
- Finance adapter interface with CSV/manual import before real Open Banking.
- OCR/document intake for receipts, labs, contracts, business cards, and financial documents.
- File attachment model across tasks, finance, health, and knowledge records.
- Duplicate detection for imported transactions, tasks, events, and documents.
- Sync status UI with connected, needs auth, failed, retry.

## Acceptance Criteria

- Every integration has a manual fallback.
- Failed syncs are visible and retryable.
- Imported private content is redacted from logs.
