from __future__ import annotations
from config import settings

try:
    from supabase import create_client, Client
except ModuleNotFoundError:  # pragma: no cover - local/dev fallback
    create_client = None  # type: ignore[assignment]
    Client = object  # type: ignore[assignment]

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        if create_client is None:
            raise RuntimeError("supabase client is not installed")
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
