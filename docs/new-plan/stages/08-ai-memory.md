# Stage 08 - AI Memory And Personalization

## Goal

Create long-term AI memory that remembers goals, preferences, habits, baselines, and feedback while keeping the user in control.

## Features

- Memory schema for preferences, goals, habits, context facts, baselines, interaction style, and feedback.
- Memory write policies: explicit instruction, confirmed preference, inferred pattern awaiting confirmation.
- Baseline calculation for sleep, activity, productivity, spending, mood, energy, and stress.
- RAG retrieval over notes, tasks, goals, reviews, health summaries, finance summaries, and preferences.
- AI profile preview with edit and delete controls.
- Conversational training: remember this, do not suggest this, change reminder style, correction feedback.
- Personalization of detail level, frequency, tone, and preferred times.
- Safety filters for health, finance, legal, tax, and investment claims.
- AI explanations with source references and confidence markers.

## Acceptance Criteria

- User can inspect and delete memory items.
- Inferred memory is not treated as confirmed fact until accepted.
- Retrieval is scoped to the current user.
