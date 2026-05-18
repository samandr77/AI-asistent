import importlib
import os
import sys

import pytest


_REQUIRED_PREFIXES = (
    "SUPABASE_",
    "OPENAI_",
    "GROQ_",
    "ANTHROPIC_",
    "HUGGINGFACE_",
    "SENTRY_",
    "ENVIRONMENT",
    "ALLOWED_ORIGINS",
    "DAILY_USER_TOKEN_BUDGET",
    "DAILY_FREE_TOKEN_BUDGET",
    "DAILY_PREMIUM_TOKEN_BUDGET",
    "MAX_AUDIO_SECONDS",
    "REVENUECAT_",
    "ADMIN_",
    "FREE_",
    "REDIS_",
)

# Modules that capture `from config import settings` at import time. Reloading
# config alone leaves these holding references to the previous settings object,
# which leaks state into other test files. Clear them all and restore on teardown.
_CONFIG_DEPENDENT_MODULES = (
    "main",
    "config",
    "api",
    "api.admin",
    "api.auth",
    "api.dump",
    "api.goals",
    "api.memory",
    "api.premium",
    "api.reflections",
    "api.revenuecat_webhook",
    "api.tasks",
    "auth",
    "database",
    "services.account_cleanup",
    "services.ai_budget",
    "services.ai_router",
    "services.premium",
)


@pytest.fixture(autouse=True)
def _restore_modules():
    """Snapshot config-dependent modules before the test, restore after."""
    saved = {name: sys.modules.get(name) for name in _CONFIG_DEPENDENT_MODULES}
    yield
    for name in _CONFIG_DEPENDENT_MODULES:
        sys.modules.pop(name, None)
        if saved[name] is not None:
            sys.modules[name] = saved[name]


def _reload_config(monkeypatch, env: dict[str, str]):
    for key in list(os.environ):
        if key.startswith(_REQUIRED_PREFIXES):
            monkeypatch.delenv(key, raising=False)
    # Run from backend dir so .env isn't auto-loaded during reload
    monkeypatch.chdir("/tmp")
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    sys.modules.pop("config", None)
    return importlib.import_module("config")


def _valid_env() -> dict[str, str]:
    return {
        "SUPABASE_URL": "https://abc.supabase.co",
        "SUPABASE_SERVICE_KEY": "sk",
        "SUPABASE_JWT_SECRET": "jwt",
        "ANTHROPIC_API_KEY": "ant",
        "REVENUECAT_WEBHOOK_SECRET": "rc-secret",
        "ADMIN_CLEANUP_SECRET": "admin-secret",
        "ENVIRONMENT": "production",
    }


def test_config_loads_with_all_required(monkeypatch):
    cfg = _reload_config(monkeypatch, _valid_env())
    assert cfg.settings.supabase_url == "https://abc.supabase.co"
    assert cfg.settings.daily_user_token_budget == 200_000
    assert cfg.settings.max_audio_seconds == 180


def test_config_missing_supabase_url_raises(monkeypatch):
    env = _valid_env()
    del env["SUPABASE_URL"]
    with pytest.raises(Exception):
        _reload_config(monkeypatch, env)


def test_config_missing_anthropic_key_raises(monkeypatch):
    env = _valid_env()
    del env["ANTHROPIC_API_KEY"]
    with pytest.raises(Exception):
        _reload_config(monkeypatch, env)


def test_config_missing_revenuecat_secret_raises(monkeypatch):
    env = _valid_env()
    del env["REVENUECAT_WEBHOOK_SECRET"]
    with pytest.raises(Exception):
        _reload_config(monkeypatch, env)


def test_config_missing_admin_cleanup_secret_raises(monkeypatch):
    env = _valid_env()
    del env["ADMIN_CLEANUP_SECRET"]
    with pytest.raises(Exception):
        _reload_config(monkeypatch, env)


def test_config_optional_sentry_dsn_defaults_empty(monkeypatch):
    cfg = _reload_config(monkeypatch, _valid_env())
    assert cfg.settings.sentry_dsn == ""
