import importlib
import sys
from unittest.mock import patch

import pytest


@pytest.fixture
def reload_main():
    """Reload main+config under a patch, then restore to avoid test pollution."""
    saved_main = sys.modules.get("main")
    saved_config = sys.modules.get("config")

    def _reload():
        sys.modules.pop("main", None)
        sys.modules.pop("config", None)
        return importlib.import_module("main")

    yield _reload

    sys.modules.pop("main", None)
    sys.modules.pop("config", None)
    if saved_config is not None:
        sys.modules["config"] = saved_config
    if saved_main is not None:
        sys.modules["main"] = saved_main


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
