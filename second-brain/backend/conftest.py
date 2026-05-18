"""Root conftest: ensure required env vars exist before any backend import.

Tests must not depend on the developer's local .env. Placeholders here keep
config.py happy during collection; individual tests can still override via
monkeypatch.
"""
import os

_REQUIRED_TEST_ENV = {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_KEY": "test-service-key",
    "SUPABASE_JWT_SECRET": "test-jwt-secret",
    "ANTHROPIC_API_KEY": "test-anthropic",
    "REVENUECAT_WEBHOOK_SECRET": "test-rc-secret",
    "ADMIN_CLEANUP_SECRET": "test-admin-cleanup-secret",
}

for key, value in _REQUIRED_TEST_ENV.items():
    os.environ.setdefault(key, value)


# Hard guard: refuse to run the integration suite against production Supabase.
# Override via I_UNDERSTAND_RLS_WILL_DELETE=1 only for disaster-case debugging.
def _integration_prod_guard() -> None:
    supabase_url = os.environ.get("SUPABASE_URL", "")
    if "prod" in supabase_url.lower() and os.environ.get(
        "I_UNDERSTAND_RLS_WILL_DELETE"
    ) != "1":
        import pytest

        pytest.exit(
            "Integration suite refuses to run against production "
            f"(SUPABASE_URL={supabase_url}). "
            "Set I_UNDERSTAND_RLS_WILL_DELETE=1 to override."
        )


_integration_prod_guard()
