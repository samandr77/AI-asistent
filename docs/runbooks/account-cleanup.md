# Runbook: Account cleanup cron

## What it does

Hard-deletes users whose soft-delete (`user_profiles.deleted_at`) is more than
30 days old. Drops all rows from: `daily_reflections`, `tasks`, `goals`,
`dumps`, `user_ai_usage`, `user_premium`, `user_profiles`, and finally the
`auth.users` row itself.

## Schedule

- Daily at 04:15 UTC via `.github/workflows/cleanup-cron.yml`.
- `workflow_dispatch` enabled — you can run it manually from the Actions tab.

## Manual invocation (incident / debugging)

```bash
# From a machine with the admin secret
curl -X POST \
  -H "Authorization: Bearer $ADMIN_CLEANUP_SECRET" \
  "$BACKEND_URL/admin/cleanup-deleted"
```

Expected 200 response body:

```json
{
  "processed": 3,
  "deleted_users": ["uuid1", "uuid2", "uuid3"],
  "errors": [],
  "ran_at": "2026-04-24T04:15:22Z"
}
```

## Failure modes

| HTTP | Meaning                                    | Action                            |
|------|--------------------------------------------|-----------------------------------|
| 401  | Wrong/missing bearer                       | Check `ADMIN_CLEANUP_SECRET` in Railway + GitHub secrets match |
| 409  | Another cleanup run already in progress    | Wait; advisory lock auto-releases |
| 500  | RPC `cascade_delete_user` missing          | Re-apply migration 009            |
| 200 with `errors[]` populated | Some users failed individually | Inspect each `error` string; if FK violation, a new user-owned table was added but not added to `cascade_delete_user` — update migration and redeploy |

## Verifying after a run

```sql
-- All soft-deleted users older than 30 days should be gone from user_profiles
select count(*) from public.user_profiles
  where deleted_at < now() - interval '30 days';
-- Expect: 0
```

## Disabling temporarily

Rename `.github/workflows/cleanup-cron.yml` → `.disabled` (or set `schedule:` to an empty list) and merge. GitHub Actions pauses the cron. Re-enable by reverting.

## Related

- Migration 009 added `deleted_at` column + `cascade_delete_user` RPC: `supabase/migrations/009_account_deletion.sql`.
- API endpoint: `second-brain/backend/api/admin.py::cleanup_deleted`.
- Service: `second-brain/backend/services/account_cleanup.py::purge_due_users`.
