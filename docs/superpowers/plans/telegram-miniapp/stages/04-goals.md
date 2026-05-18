# Stage 4 - Goals

## Objective

Port goal planning and progress tracking into the Telegram Mini App, preserving goal-aware AI parsing and premium active-goal limits.

## Screens

- Goals list: `/goals`
- New goal: `/goals/new`
- Goal detail: `/goals/:id`

## Work To Do

- Port status tabs:
  - active.
  - paused.
  - achieved.
  - archived.
- Port goal cards with target date and progress.
- Port create goal form.
- Port goal detail:
  - editable title.
  - target date.
  - computed progress.
  - status changes.
  - linked tasks.
  - delete.
- Add navigation from linked task to task detail.
- Preserve active-goal limit for free users.
- Preserve goal auto-linking in dump parsing through existing backend active-goal lookup.

## Backend API Reuse

- `GET /goals/`
- `GET /goals/{goal_id}`
- `POST /goals/`
- `PATCH /goals/{goal_id}`
- `DELETE /goals/{goal_id}`
- `POST /goals/{goal_id}/tasks/{task_id}`
- `DELETE /goals/{goal_id}/tasks/{task_id}`
- `GET /goals/{goal_id}/tasks`
- `GET /goals/{goal_id}/progress`

## Frontend Files

- `second-brain/telegram-miniapp/src/screens/goals/GoalsScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/goals/NewGoalScreen.tsx`
- `second-brain/telegram-miniapp/src/screens/goals/GoalDetailScreen.tsx`
- `second-brain/telegram-miniapp/src/components/GoalCard.tsx`
- `second-brain/telegram-miniapp/src/components/ProgressBar.tsx`
- `second-brain/telegram-miniapp/src/components/StatusTabs.tsx`

## Validation Rules

- Title required.
- Title max 200 chars.
- Description max 2000 chars.
- Target date cannot be in the past.
- Sphere must be one of the existing seven spheres.
- Progress percent must stay 0-100.

## Tests

- Goals list loads by status.
- Empty active goals state links to New Goal.
- Goal creation validates required title.
- Past target date is rejected before backend call.
- Goal limit opens Premium.
- Detail screen renders linked tasks and progress.
- Status change updates backend and cache.
- Delete removes goal and returns to list.

## Acceptance Criteria

- Telegram Mini App has feature parity with mobile goals.
- Goal-aware task parsing remains unchanged.
- Free user cannot exceed active-goal limit.
- Premium user can create unlimited active goals.
