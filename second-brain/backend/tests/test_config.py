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
    "FREE_",
    "REDIS_",
)


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


def test_config_optional_sentry_dsn_defaults_empty(monkeypatch):
    cfg = _reload_config(monkeypatch, _valid_env())
    assert cfg.settings.sentry_dsn == ""
