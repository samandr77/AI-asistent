import importlib
import sys
from unittest.mock import patch

import pytest


# Modules that hold a `from config import settings` binding at import time.
# When `reload_main` re-imports config it creates a fresh `settings` object,
# which leaks into other tests via the stale references in these modules.
# We snapshot+restore them all so subsequent tests see the original instances.
_DEPENDENT_MODULES = (
    "main",
    "config",
    "api",
    "api.admin",
    "api.auth",
    "api.dump",
    "api.goals",
    "api.health",
    "api.memory",
    "api.premium",
    "api.reflections",
    "api.revenuecat_webhook",
    "api.tasks",
    "api.telegram_auth",
    "auth",
    "database",
    "services.account_cleanup",
    "services.ai_budget",
    "services.ai_router",
    "services.premium",
    "services.telegram_deeplinks",
    "services.telegram_init_data",
    "services.telegram_users",
)


@pytest.fixture
def reload_main():
    """Reload main+config under a patch, then restore to avoid test pollution."""
    saved = {name: sys.modules.get(name) for name in _DEPENDENT_MODULES}

    def _reload():
        for name in _DEPENDENT_MODULES:
            sys.modules.pop(name, None)
        return importlib.import_module("main")

    yield _reload

    for name in _DEPENDENT_MODULES:
        sys.modules.pop(name, None)
    for name, module in saved.items():
        if module is not None:
            sys.modules[name] = module


def test_sentry_init_called_when_dsn_set(monkeypatch, reload_main):
    monkeypatch.setenv("SENTRY_DSN", "https://public@sentry.example/1")
    with patch("sentry_sdk.init") as mock_init:
        reload_main()
        assert mock_init.called
        kwargs = mock_init.call_args.kwargs
        assert kwargs["dsn"] == "https://public@sentry.example/1"
        assert kwargs["traces_sample_rate"] == 0.2


def test_sentry_not_initialized_without_dsn(monkeypatch, reload_main):
    monkeypatch.setenv("SENTRY_DSN", "")
    with patch("sentry_sdk.init") as mock_init:
        reload_main()
        assert not mock_init.called


def test_health_endpoint_exists(reload_main):
    paths = {r.path for r in reload_main().app.routes}
    assert "/health" in paths
    assert "/health/ready" in paths
    assert "/health/dashboard" in paths
