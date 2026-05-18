# Stage 3 - Core Dump And Tasks

## Objective

Port the central Second Brain workflow: capture text/voice, parse into tasks, show results, manage today's tasks, and browse task history.

## Screens

- Today: `/today`
- Dump composer: `/dump`
- Dump result: `/result/:dumpId`
- All tasks: `/tasks`
- Task detail: `/tasks/:id`

## Work To Do

- Port Today screen from Expo.
- Port Dump composer text mode.
- Add voice recording with MediaRecorder where supported.
- Add bot voice fallback messaging for unsupported clients.
- Add dump result screen backed by `dump_id`.
- Port all tasks/history screen.
- Port task detail screen.
- Add web offline queue for text dumps.
- Add queue indicator on Today.
- Preserve premium limit behavior:
  - daily dump limit.
  - 30-day history cutoff.
  - AI budget errors.
- Preserve task actions:
  - edit title.
  - mark done.
  - delete.
  - show notes/deadline/reminder.

## Backend Work

- Reuse `POST /dump/text`.
- Reuse `POST /dump/voice`.
- Reuse `GET /tasks/today`.
- Reuse `GET /tasks/`.
- Reuse `PATCH /tasks/{id}`.
- Reuse `DELETE /tasks/{id}`.
- Add result reload endpoint if needed:
  - `GET /dump/{dump_id}` or `GET /dump/{dump_id}/result`.
  - This avoids relying on large JSON route params in web navigation.

## Frontend Files

- `second-brain/telegram-miniapp/src/screens/today/TodayScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/dump/DumpScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/dump/ResultScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/tasks/TasksScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/tasks/TaskDetailScreen.tsx`
- `second-brain/telegram-miniapp/src/services/dumpQueue.ts`
- `second-brain/telegram-miniapp/src/services/recorder.ts`
- `second-brain/telegram-miniapp/src/components/TaskCard.tsx`
- `second-brain/telegram-miniapp/src/components/SphereFilter.tsx`

## UI States

- Loading.
- Empty today.
- Empty history.
- AI processing.
- Offline queued.
- Queue draining.
- Premium limit reached.
- Voice unsupported.
- Upload too large.
- Parse error.
- Retry.

## Tests

- Text dump creates tasks and navigates to result.
- Voice mode hides or falls back when MediaRecorder is unavailable.
- 402 from dump opens premium screen.
- Today refresh renders tasks.
- Task title edit calls backend and updates cache.
- Mark done removes task from Today.
- Delete removes task from lists.
- Free user sees history cutoff banner.
- Offline text dump is queued and later drained.

## Acceptance Criteria

- A Telegram user can create a text dump and see structured tasks.
- Task management works from Today and All Tasks.
- Voice has a reliable path: in-app recording when supported, bot fallback when not.
- Free/premium restrictions are visible and enforced by backend.
