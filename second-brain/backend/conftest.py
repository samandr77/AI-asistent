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
}

for key, value in _REQUIRED_TEST_ENV.items():
    os.environ.setdefault(key, value)
