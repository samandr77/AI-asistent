# Second Brain Privacy Policy

_Last updated: {{TODO: lawyer — insert publication date}}_

## 1. Data Controller

Second Brain ("the app", "we") is a mobile application developed by {{TODO: lawyer — legal entity name and country of registration}}. Contact for data-related inquiries: **support@second-brain.app**.

## 2. Categories of Data Collected

| Category             | Example                                           | Purpose                                        |
|----------------------|---------------------------------------------------|------------------------------------------------|
| Identifiers          | Email, user_id, Apple/Google OAuth tokens         | Authentication, device identity                |
| User content         | Voice dumps, task text, goals, reflections        | Core app functionality                         |
| Audio data           | Voice recordings                                  | Transcription → task parsing                   |
| Diagnostics          | Stack traces, performance metrics                 | Crash analytics (Sentry), opt-in               |
| Billing metadata     | Subscription ID (no card number)                  | Verify Premium status                          |

{{TODO: lawyer — enumerate exact fields per GDPR art. 13(1)(c) (purposes) and 13(2)(a) (retention period)}}

## 3. Purposes

- Deliver app functionality (parse dumps into tasks, store tasks/goals/reflections)
- Authenticate and secure user accounts
- Diagnose crashes and improve quality
- Process subscriptions through App Store / Google Play

## 4. Legal basis

- Performance of a contract (provision of service) — GDPR art. 6(1)(b)
- Legitimate interest (security, diagnostics) — GDPR art. 6(1)(f)
- Consent (where applicable) — GDPR art. 6(1)(a)

## 5. Retention

- Active-account data — until the user deletes the account.
- After deletion — permanently erased **after 30 days**. Recovery is possible within those 30 days through support@second-brain.app.
- Diagnostics (Sentry) — 90 days, then automatically purged.
- Database backups — {{TODO: lawyer — specify Supabase backup retention, typically 7 days}}.

## 6. Third-party data processors

We share a limited subset of data with the following data processors:

| Service         | Role                                | Server region        |
|-----------------|-------------------------------------|----------------------|
| Supabase        | Database hosting and authentication | EU (Frankfurt)       |
| Anthropic       | AI dump parsing (Claude API)        | US                   |
| OpenAI          | Audio transcription (Whisper API)   | US                   |
| Groq            | AI dump parsing                     | US                   |
| Sentry          | Crash analytics (anonymised)        | EU / US              |
| RevenueCat      | Subscription management             | US                   |
| Apple / Google  | Payments and sign-in                | Platform policies    |

{{TODO: lawyer — SCC / adequacy for cross-border transfer to US}}

## 7. User rights under GDPR

- Access (art. 15) — request copy via support@second-brain.app.
- Rectification (art. 16) — through the app UI or support.
- Erasure (art. 17) — via Profile → "Delete account", or support.
- Restriction (art. 18) — through support.
- Portability (art. 20) — export on request via support.
- Lodge a complaint with a supervisory authority (art. 77).

## 8. Security

- TLS 1.2+ encryption in transit.
- Row-Level Security in Postgres: only the owner can read their rows.
- {{TODO: lawyer — specify Supabase managed encryption-at-rest}}.

## 9. Cookies

The mobile app does not use cookies. {{TODO: lawyer — extend if a web version is added}}

## 10. Children

The app is not intended for users under 13 (under 16 in EU per GDPR). {{TODO: lawyer — verify the age threshold per jurisdiction}}

## 11. Changes to this policy

We notify users of material changes to this policy by email and/or in-app at least 30 days before the effective date. Current version: {{TODO: version}}, effective {{TODO: date}}.

## 12. Contact

- General inquiries: support@second-brain.app
- DPO: {{TODO: lawyer — contact or "not appointed (not required for companies < 250 staff)"}}
- Address: {{TODO: lawyer — legal address}}
