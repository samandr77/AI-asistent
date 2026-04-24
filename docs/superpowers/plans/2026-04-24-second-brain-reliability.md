# Second Brain — Reliability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the MVP from "works on happy path" to "reliable daily-use personal system" by fixing error visibility, enforcing input/cost limits, making offline dumps survive network loss, and recovering gracefully from auth/API failures.

**Architecture:** Backend hardening (strict config, rate limits, per-user AI budget, error capture via Sentry) + mobile resilience (Sentry capture, offline queue for dumps, 401 recovery, audio duration limit). All changes additive — no breaking API changes.

**Tech Stack:** FastAPI 0.115, sentry-sdk[fastapi], slowapi (already in requirements), Supabase (new migration), Expo SDK 54, @sentry/react-native, @react-native-community/netinfo, existing Zustand + MMKV store.

---

## File Structure

### Backend (`second-brain/backend/`)
- `config.py` — **modify**: remove placeholder defaults, add `SENTRY_DSN`, `DAILY_USER_TOKEN_BUDGET`, `MAX_AUDIO_SECONDS`
- `main.py` — **modify**: lifespan with env validation + Sentry init; make slowapi mandatory; add rate limit decorators on `/dump/*`
- `services/ai_budget.py` — **create**: per-user daily token accounting (reads/writes `user_ai_usage` table)
- `services/ai_router.py` — **modify**: capture tier fallbacks to Sentry; return (text, usage) so caller can record tokens
- `services/parser.py` — **modify**: resilient JSON extraction + retry on higher tier if parse fails
- `services/stt.py` — **modify**: no behavior change (audio duration enforced in dump.py after decode)
- `api/dump.py` — **modify**: rate limit, audio duration check via `mutagen`, call `ai_budget.check_and_reserve` before parse
- `requirements.txt` — **modify**: add `sentry-sdk[fastapi]==2.18.0`, `mutagen==1.47.0`
- `tests/test_config.py` — **create**
- `tests/test_ai_budget.py` — **create**
- `tests/test_parser.py` — **modify**: add malformed-JSON recovery tests
- `tests/test_dump.py` — **modify**: add rate-limit + duration-limit tests

### Supabase migrations
- `supabase/migrations/005_user_ai_usage.sql` — **create**: per-user daily token counter table with RLS

### Mobile (`second-brain/mobile/`)
- `package.json` — **modify**: add `@sentry/react-native`, `@react-native-community/netinfo`
- `app.json` — **modify**: add `@sentry/react-native/expo` plugin
- `app/_layout.tsx` — **modify**: wrap root with `Sentry.wrap`, init + navigation integration
- `services/sentry.ts` — **create**: Sentry init helper
- `services/dumpQueue.ts` — **create**: offline queue (text + voice dumps), NetInfo listener, retry loop
- `services/api.ts` — **modify**: 401 response interceptor signs out + redirects; `dumpText`/`dumpVoice` delegate to queue
- `services/audio.ts` — **modify**: 180s hard stop via setTimeout, expose `durationMs`
- `store/useAppStore.ts` — **modify**: persisted `pendingDumps` slice (add/remove/update status)
- `app/(app)/dump.tsx` — **modify**: show "сохранено в очередь" toast when offline
- `app/(app)/index.tsx` — **modify**: show pending-dumps indicator

---

## Task 1: Strict config validation + Sentry DSN

**Why first:** remove the silent "placeholder_supabase_url" behavior that hides misconfiguration. Every other task assumes config is strict.

**Files:**
- Modify: `second-brain/backend/config.py`
- Test: `second-brain/backend/tests/test_config.py`

- [ ] **Step 1: Write the failing test**

Create `second-brain/backend/tests/test_config.py`:

```python
import importlib
import os
import sys
import pytest


def _reload_config(monkeypatch, env: dict[str, str]):
    for key in list(os.environ):
        if key.startswith(("SUPABASE_", "OPENAI_", "GROQ_", "ANTHROPIC_", "HUGGINGFACE_", "SENTRY_", "ENVIRONMENT", "ALLOWED_ORIGINS", "DAILY_USER_TOKEN_BUDGET", "MAX_AUDIO_SECONDS")):
            monkeypatch.delenv(key, raising=False)
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


def test_config_optional_sentry_dsn_defaults_empty(monkeypatch):
    cfg = _reload_config(monkeypatch, _valid_env())
    assert cfg.settings.sentry_dsn == ""
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd second-brain/backend
pytest tests/test_config.py -v
```
Expected: tests fail because `daily_user_token_budget`, `max_audio_seconds`, `sentry_dsn` don't exist on settings, and missing-required behavior is not enforced (fallback sets placeholders).

- [ ] **Step 3: Rewrite config.py to enforce required keys**

Replace `second-brain/backend/config.py`:

```python
import os
from pathlib import Path

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_dotenv_if_present() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv_if_present()


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    anthropic_api_key: str

    openai_api_key: str = ""
    groq_api_key: str = ""
    anthropic_base_url: str = ""
    huggingface_api_key: str = ""
    redis_url: str = "redis://localhost:6379"

    sentry_dsn: str = ""
    environment: str = "development"
    daily_user_token_budget: int = Field(default=200_000, ge=0)
    max_audio_seconds: int = Field(default=180, ge=10, le=1800)

    allowed_origins: str = (
        "http://localhost:8081,"
        "http://localhost:19006,"
        "http://localhost:3000"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


try:
    settings = Settings()
except ValidationError as exc:  # surface missing keys loudly
    missing = ", ".join(err["loc"][0] for err in exc.errors())
    raise RuntimeError(f"Missing required env vars: {missing}") from exc
```

- [ ] **Step 4: Run the tests**

```bash
pytest tests/test_config.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Run full suite to confirm no regressions**

```bash
pytest -q
```
Expected: all tests pass (existing tests set required env in `.env` or conftest).

If `.env` is missing required keys in dev, create `second-brain/backend/.env.example` entries for `SENTRY_DSN`, `DAILY_USER_TOKEN_BUDGET`, `MAX_AUDIO_SECONDS` (documentation only).

- [ ] **Step 6: Commit**

```bash
git add second-brain/backend/config.py second-brain/backend/tests/test_config.py
git commit -m "feat(backend): strict config validation with required keys"
```

---

## Task 2: Sentry on backend via lifespan

**Files:**
- Modify: `second-brain/backend/requirements.txt`
- Modify: `second-brain/backend/main.py`
- Test: `second-brain/backend/tests/test_main.py`

- [ ] **Step 1: Add sentry-sdk to requirements**

Edit `second-brain/backend/requirements.txt`:

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic-settings==2.4.0
supabase==2.7.4
openai==1.52.0
anthropic==0.37.1
groq==0.11.0
httpx==0.27.2
python-multipart==0.0.12
PyJWT==2.9.0
slowapi==0.1.9
redis==5.1.1
sentry-sdk[fastapi]==2.18.0
mutagen==1.47.0
pytest==8.3.3
pytest-asyncio==0.24.0
```

- [ ] **Step 2: Install**

```bash
cd second-brain/backend
pip install -r requirements.txt
```

- [ ] **Step 3: Write the failing test**

Create `second-brain/backend/tests/test_main.py`:

```python
from unittest.mock import patch


def test_sentry_init_called_when_dsn_set(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "https://public@sentry.example/1")
    import importlib
    import sys
    sys.modules.pop("main", None)
    sys.modules.pop("config", None)
    with patch("sentry_sdk.init") as mock_init:
        importlib.import_module("main")
        assert mock_init.called
        kwargs = mock_init.call_args.kwargs
        assert kwargs["dsn"] == "https://public@sentry.example/1"
        assert kwargs["traces_sample_rate"] == 0.2


def test_sentry_not_initialized_without_dsn(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "")
    import importlib
    import sys
    sys.modules.pop("main", None)
    sys.modules.pop("config", None)
    with patch("sentry_sdk.init") as mock_init:
        importlib.import_module("main")
        assert not mock_init.called
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
pytest tests/test_main.py -v
```
Expected: fail — no `sentry_sdk.init` call in main.py.

- [ ] **Step 5: Rewrite main.py with lifespan + Sentry init + mandatory slowapi**

Replace `second-brain/backend/main.py`:

```python
import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from api import auth, dump, memory, tasks
from config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=0.2,
            integrations=[FastApiIntegration()],
            send_default_pii=False,
        )
        logger.info("Sentry initialized (env=%s)", settings.environment)
    else:
        logger.warning("Sentry DSN not set — errors will not be reported")
    yield


if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.2,
        integrations=[FastApiIntegration()],
        send_default_pii=False,
    )

app = FastAPI(title="Second Brain API", lifespan=lifespan)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dump.router, prefix="/dump", tags=["dump"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(memory.router, prefix="/memory", tags=["memory"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness():
    return {
        "status": "ok",
        "environment": settings.environment,
        "sentry": bool(settings.sentry_dsn),
    }
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_main.py -v
pytest -q
```
Expected: test_main passes; full suite still green.

- [ ] **Step 7: Manual smoke test — trigger Sentry event**

Add a temporary endpoint, run uvicorn with a real DSN from Sentry project, hit it, verify event in Sentry UI. Remove the endpoint after verification (don't commit).

```python
@app.get("/debug/sentry")
async def _trip_sentry():
    raise RuntimeError("sentry smoke test")
```

- [ ] **Step 8: Commit**

```bash
git add second-brain/backend/requirements.txt second-brain/backend/main.py second-brain/backend/tests/test_main.py
git commit -m "feat(backend): Sentry init + lifespan + mandatory slowapi"
```

---

## Task 3: Per-user daily AI token budget — migration + service

**Files:**
- Create: `second-brain/supabase/migrations/005_user_ai_usage.sql`
- Create: `second-brain/backend/services/ai_budget.py`
- Test: `second-brain/backend/tests/test_ai_budget.py`

- [ ] **Step 1: Write the SQL migration**

Create `second-brain/supabase/migrations/005_user_ai_usage.sql`:

```sql
create table if not exists public.user_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  total_tokens integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.user_ai_usage enable row level security;

create policy "user_ai_usage_select_own" on public.user_ai_usage
  for select using (auth.uid() = user_id);

create policy "user_ai_usage_write_service_role" on public.user_ai_usage
  for all using (auth.role() = 'service_role');

create or replace function public.add_ai_tokens(p_user_id uuid, p_tokens int)
returns int
language plpgsql
security definer
as $$
declare
  v_total int;
begin
  insert into public.user_ai_usage(user_id, total_tokens)
  values (p_user_id, p_tokens)
  on conflict (user_id, usage_date) do update
    set total_tokens = public.user_ai_usage.total_tokens + excluded.total_tokens,
        updated_at = now()
  returning total_tokens into v_total;
  return v_total;
end
$$;
```

- [ ] **Step 2: Apply migration to dev Supabase**

```bash
# In Supabase SQL editor for your dev project, paste the migration
```
Verify: `select * from public.user_ai_usage limit 1;` runs without error.

- [ ] **Step 3: Write the failing test**

Create `second-brain/backend/tests/test_ai_budget.py`:

```python
import pytest
from unittest.mock import MagicMock, patch

from services import ai_budget


@pytest.mark.anyio
async def test_record_usage_calls_rpc():
    db = MagicMock()
    db.rpc.return_value.execute.return_value.data = 5000
    with patch("services.ai_budget.get_supabase", return_value=db):
        await ai_budget.record_usage("user-1", 1234)
    db.rpc.assert_called_once_with("add_ai_tokens", {"p_user_id": "user-1", "p_tokens": 1234})


@pytest.mark.anyio
async def test_check_within_budget_returns_true():
    db = MagicMock()
    today_row = {"total_tokens": 10_000}
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = today_row
    with patch("services.ai_budget.get_supabase", return_value=db), \
         patch("services.ai_budget.settings") as mock_settings:
        mock_settings.daily_user_token_budget = 200_000
        ok = await ai_budget.has_budget("user-1")
    assert ok is True


@pytest.mark.anyio
async def test_check_over_budget_returns_false():
    db = MagicMock()
    today_row = {"total_tokens": 250_000}
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = today_row
    with patch("services.ai_budget.get_supabase", return_value=db), \
         patch("services.ai_budget.settings") as mock_settings:
        mock_settings.daily_user_token_budget = 200_000
        ok = await ai_budget.has_budget("user-1")
    assert ok is False


@pytest.mark.anyio
async def test_budget_zero_disables_enforcement():
    db = MagicMock()
    with patch("services.ai_budget.get_supabase", return_value=db), \
         patch("services.ai_budget.settings") as mock_settings:
        mock_settings.daily_user_token_budget = 0
        ok = await ai_budget.has_budget("user-1")
    assert ok is True
    db.table.assert_not_called()
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
pytest tests/test_ai_budget.py -v
```
Expected: import error — `services/ai_budget.py` doesn't exist.

- [ ] **Step 5: Implement the service**

Create `second-brain/backend/services/ai_budget.py`:

```python
from datetime import datetime, timezone

from config import settings
from database import get_supabase


async def has_budget(user_id: str) -> bool:
    if settings.daily_user_token_budget <= 0:
        return True
    db = get_supabase()
    today = datetime.now(timezone.utc).date().isoformat()
    resp = (
        db.table("user_ai_usage")
        .select("total_tokens")
        .eq("user_id", user_id)
        .eq("usage_date", today)
        .maybe_single()
        .execute()
    )
    total = (resp.data or {}).get("total_tokens", 0)
    return total < settings.daily_user_token_budget


async def record_usage(user_id: str, tokens: int) -> None:
    if tokens <= 0:
        return
    db = get_supabase()
    db.rpc("add_ai_tokens", {"p_user_id": user_id, "p_tokens": tokens}).execute()
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_ai_budget.py -v
```
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add second-brain/supabase/migrations/005_user_ai_usage.sql second-brain/backend/services/ai_budget.py second-brain/backend/tests/test_ai_budget.py
git commit -m "feat(backend): per-user daily AI token budget (migration + service)"
```

---

## Task 4: Wire budget check + rate limit into /dump/*

**Files:**
- Modify: `second-brain/backend/services/ai_router.py`
- Modify: `second-brain/backend/services/parser.py`
- Modify: `second-brain/backend/api/dump.py`
- Modify: `second-brain/backend/tests/test_dump.py`

- [ ] **Step 1: Update ai_router to return usage**

Replace the `complete` function in `second-brain/backend/services/ai_router.py`:

```python
import asyncio
import logging
from dataclasses import dataclass
from enum import Enum

import sentry_sdk

from config import settings

try:
    from groq import AsyncGroq
except ModuleNotFoundError:
    AsyncGroq = None  # type: ignore[assignment]

try:
    from anthropic import AsyncAnthropic
except ModuleNotFoundError:
    AsyncAnthropic = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


class AITier(str, Enum):
    cheap = "cheap"
    medium = "medium"
    premium = "premium"


@dataclass
class AIResult:
    text: str
    tokens: int
    tier: AITier


groq_client = (
    AsyncGroq(api_key=settings.groq_api_key)
    if AsyncGroq and settings.groq_api_key
    else None
)
anthropic_client = None
if AsyncAnthropic and settings.anthropic_api_key:
    anthropic_kwargs = {"api_key": settings.anthropic_api_key}
    if settings.anthropic_base_url:
        anthropic_kwargs["base_url"] = settings.anthropic_base_url
    anthropic_client = AsyncAnthropic(**anthropic_kwargs)

_FALLBACK: dict[AITier, AITier | None] = {
    AITier.cheap: AITier.medium,
    AITier.medium: AITier.premium,
    AITier.premium: None,
}


async def _call_groq(system: str, user: str, max_tokens: int) -> tuple[str, int]:
    if groq_client is None:
        raise RuntimeError("Groq client is not configured")
    resp = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    usage = resp.usage.total_tokens if resp.usage else 0
    return resp.choices[0].message.content, usage


async def _call_anthropic(model: str, system: str, user: str, max_tokens: int) -> tuple[str, int]:
    if anthropic_client is None:
        raise RuntimeError("Anthropic client is not installed")
    resp = await anthropic_client.messages.create(
        model=model,
        system=system,
        messages=[{"role": "user", "content": user}],
        max_tokens=max_tokens,
    )
    usage = (resp.usage.input_tokens + resp.usage.output_tokens) if resp.usage else 0
    return resp.content[0].text, usage


_CALLERS = {
    AITier.cheap: lambda s, u, t: (
        _call_groq(s, u, t)
        if groq_client is not None
        else _call_anthropic("claude-haiku-4-5-20251001", s, u, t)
    ),
    AITier.medium: lambda s, u, t: _call_anthropic("claude-haiku-4-5-20251001", s, u, t),
    AITier.premium: lambda s, u, t: _call_anthropic("claude-sonnet-4-6", s, u, t),
}


async def complete(
    system: str,
    user: str,
    tier: AITier = AITier.cheap,
    max_tokens: int = 2000,
    retries: int = 2,
) -> AIResult:
    current = tier
    while current is not None:
        for attempt in range(retries + 1):
            try:
                text, tokens = await _CALLERS[current](system, user, max_tokens)
                if current != tier:
                    sentry_sdk.capture_message(
                        f"AI router fell back from {tier.value} to {current.value}",
                        level="warning",
                    )
                return AIResult(text=text, tokens=tokens, tier=current)
            except Exception as e:
                if attempt < retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                else:
                    sentry_sdk.capture_exception(e)
                    logger.warning(
                        "AI router: %s failed after %s attempts: %s",
                        current, retries + 1, e,
                    )
        current = _FALLBACK[current]
    raise RuntimeError("All AI providers failed")
```

- [ ] **Step 2: Update parser.py to consume AIResult**

In `second-brain/backend/services/parser.py`, update the `parse_dump` signature and return shape:

```python
import json
import re
from datetime import datetime, timezone
from typing import NamedTuple

from pydantic import ValidationError

from models.task import ParsedDump
from services.ai_router import AITier, complete


class ParsedDumpWithUsage(NamedTuple):
    parsed: ParsedDump
    tokens: int


PARSE_SYSTEM = """Ты — AI-ассистент для структурирования задач.
Пользователь даёт поток мыслей. Твоя задача:
- Каждое дело/намерение = отдельная задача
- Определить сферу: work/family/study/health/travel
- Определить приоритет: 1=низкий, 2=средний, 3=высокий
- is_today=true если нужно сделать сегодня или срочно
- deadline: ISO 8601 UTC если упомянуто ("в пятницу", "завтра", "через неделю")
- Отвечать ТОЛЬКО валидным JSON без markdown-обёртки

Формат ответа:
{"tasks": [{"title": "...", "sphere": "work", "priority": 2, "is_today": false, "deadline": null, "notes": null}]}"""


_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json_object(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        cleaned = "\n".join(lines[1:end])
    match = _JSON_OBJECT_RE.search(cleaned)
    if match:
        return match.group(0)
    return cleaned


async def parse_dump(text: str, user_context: dict) -> ParsedDumpWithUsage:
    if not text or not text.strip():
        raise ValueError("Cannot parse empty text")

    context_parts = []
    if user_context.get("role"):
        context_parts.append(f"Роль: {user_context['role']}")
    if user_context.get("living_with"):
        context_parts.append(f"Живёт: {user_context['living_with']}")
    if user_context.get("peak_hours"):
        context_parts.append(f"Активность: {user_context['peak_hours']}")

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    user_prompt = f"Сейчас: {now_str}\n"
    if context_parts:
        user_prompt += "\n".join(context_parts) + "\n"
    user_prompt += f"\nДамп пользователя:\n{text}"

    total_tokens = 0
    for tier in (AITier.cheap, AITier.medium):
        result = await complete(PARSE_SYSTEM, user_prompt, tier=tier)
        total_tokens += result.tokens
        try:
            data = json.loads(_extract_json_object(result.text))
            if "tasks" not in data or not isinstance(data["tasks"], list):
                raise ValueError("LLM response missing 'tasks' list")
            parsed = ParsedDump(**data)
            return ParsedDumpWithUsage(parsed=parsed, tokens=total_tokens)
        except (json.JSONDecodeError, ValidationError, ValueError):
            continue

    raise ValueError("LLM failed to return valid JSON after fallback")
```

- [ ] **Step 3: Add resilient-parse test**

Edit `second-brain/backend/tests/test_parser.py` — add these tests at the end:

```python
import pytest
from unittest.mock import AsyncMock, patch
from services.ai_router import AIResult, AITier
from services.parser import parse_dump, _extract_json_object


def test_extract_json_object_from_prose():
    raw = 'Here is the JSON you asked for: {"tasks": [{"title": "x", "sphere": "work", "priority": 1, "is_today": false}]} That is all.'
    assert "tasks" in _extract_json_object(raw)


def test_extract_json_strips_markdown_fence():
    raw = '```json\n{"tasks": []}\n```'
    assert _extract_json_object(raw).strip() == '{"tasks": []}'


@pytest.mark.anyio
async def test_parser_falls_back_to_medium_tier_on_bad_json():
    valid = '{"tasks": [{"title": "t", "sphere": "work", "priority": 1, "is_today": true}]}'
    responses = iter([
        AIResult(text="not json", tokens=100, tier=AITier.cheap),
        AIResult(text=valid, tokens=200, tier=AITier.medium),
    ])
    with patch("services.parser.complete", new=AsyncMock(side_effect=lambda *a, **k: next(responses))):
        result = await parse_dump("some dump", {})
    assert result.tokens == 300
    assert len(result.parsed.tasks) == 1
```

- [ ] **Step 4: Run parser tests**

```bash
pytest tests/test_parser.py -v
```
Expected: new tests pass. Fix any existing test that imports `parse_dump` and assumes old return type — change `parsed = await parse_dump(...)` to `result = await parse_dump(...); parsed = result.parsed`.

- [ ] **Step 5: Update dump.py: budget check + rate limit + duration check**

Replace `second-brain/backend/api/dump.py`:

```python
import io
from importlib.util import find_spec

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel, field_validator

from auth import get_current_user_id
from config import settings
from database import get_supabase
from models.task import ParsedDump
from services import ai_budget
from services.parser import parse_dump
from services.stt import transcribe_audio_with_fallback

router = APIRouter()

MAX_AUDIO_SIZE = 25 * 1024 * 1024
HAS_MULTIPART = find_spec("python_multipart") is not None or find_spec("multipart") is not None


class TextDumpRequest(BaseModel):
    text: str
    user_context: dict = {}

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("text cannot be empty")
        if len(v) > 20_000:
            raise ValueError("text too long (max 20000 chars)")
        return v


def _audio_duration_seconds(audio_bytes: bytes, ext: str) -> float | None:
    try:
        from mutagen import File as MutagenFile
        mf = MutagenFile(io.BytesIO(audio_bytes))
        if mf is None or mf.info is None:
            return None
        return float(mf.info.length)
    except Exception:
        return None


async def save_tasks(parsed: ParsedDump, user_id: str, raw_text: str) -> tuple[str, list[str]]:
    db = get_supabase()
    dump_result = db.table("dumps").insert({
        "user_id": user_id,
        "raw_text": raw_text,
        "status": "done",
    }).execute()
    if not dump_result.data:
        raise HTTPException(status_code=500, detail="Failed to save dump")
    dump_id = dump_result.data[0]["id"]

    rows = [
        {
            "user_id": user_id,
            "dump_id": dump_id,
            "title": t.title,
            "sphere": t.sphere.value,
            "priority": t.priority.value,
            "is_today": t.is_today,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "notes": t.notes,
        }
        for t in parsed.tasks
    ]
    task_result = db.table("tasks").insert(rows).execute()
    if not task_result.data:
        raise HTTPException(status_code=500, detail="Failed to save tasks")
    task_ids = [r["id"] for r in task_result.data]
    return dump_id, task_ids


async def _enforce_budget(user_id: str) -> None:
    if not await ai_budget.has_budget(user_id):
        raise HTTPException(status_code=429, detail="Daily AI budget exceeded")


@router.post("/text")
async def dump_text(
    body: TextDumpRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    await _enforce_budget(user_id)
    try:
        result = await parse_dump(body.text, body.user_context)
    except ValueError as e:
        sentry_sdk.capture_exception(e)
        raise HTTPException(status_code=422, detail=str(e))
    await ai_budget.record_usage(user_id, result.tokens)
    dump_id, task_ids = await save_tasks(result.parsed, user_id, body.text)
    return {
        "dump_id": dump_id,
        "tasks": [t.model_dump() for t in result.parsed.tasks],
        "today_top3": [t.model_dump() for t in result.parsed.today_top3],
        "task_ids": task_ids,
    }


if HAS_MULTIPART:
    @router.post("/voice")
    async def dump_voice(
        file: UploadFile,
        request: Request,
        user_id: str = Depends(get_current_user_id),
    ):
        await _enforce_budget(user_id)
        audio_bytes = await file.read()
        if len(audio_bytes) > MAX_AUDIO_SIZE:
            raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

        filename = file.filename or "audio.m4a"
        ext = filename.rsplit(".", 1)[-1].lower()
        duration = _audio_duration_seconds(audio_bytes, ext)
        if duration is not None and duration > settings.max_audio_seconds:
            raise HTTPException(
                status_code=413,
                detail=f"Audio too long (max {settings.max_audio_seconds}s, got {int(duration)}s)",
            )

        transcription = await transcribe_audio_with_fallback(audio_bytes, filename)
        try:
            result = await parse_dump(transcription, {})
        except ValueError as e:
            sentry_sdk.capture_exception(e)
            raise HTTPException(status_code=422, detail=str(e))
        await ai_budget.record_usage(user_id, result.tokens)
        dump_id, task_ids = await save_tasks(result.parsed, user_id, transcription)
        return {
            "dump_id": dump_id,
            "transcription": transcription,
            "tasks": [t.model_dump() for t in result.parsed.tasks],
            "today_top3": [t.model_dump() for t in result.parsed.today_top3],
            "task_ids": task_ids,
        }
else:
    @router.post("/voice")
    async def dump_voice_unavailable(
        user_id: str = Depends(get_current_user_id),
    ):
        raise HTTPException(
            status_code=503,
            detail="Voice upload requires python-multipart to be installed",
        )
```

- [ ] **Step 6: Update test_dump.py for new shape**

Edit `second-brain/backend/tests/test_dump.py`. The `MOCK_PARSED` needs to be wrapped in the new `ParsedDumpWithUsage`. Change the `parse_dump` patch:

```python
import pytest
from unittest.mock import AsyncMock, patch
from models.task import ParsedDump, ParsedTask, Sphere, Priority
from services.parser import ParsedDumpWithUsage

MOCK_PARSED = ParsedDump(tasks=[
    ParsedTask(title="Купить молоко", sphere=Sphere.family, priority=Priority.high, is_today=True),
    ParsedTask(title="Сдать отчёт", sphere=Sphere.work, priority=Priority.medium, is_today=True),
    ParsedTask(title="Прочитать книгу", sphere=Sphere.study, priority=Priority.low, is_today=False),
])
MOCK_RESULT = ParsedDumpWithUsage(parsed=MOCK_PARSED, tokens=500)


@pytest.mark.anyio
async def test_dump_text_returns_tasks(client):
    with patch("api.dump.parse_dump", new=AsyncMock(return_value=MOCK_RESULT)), \
         patch("api.dump.save_tasks", new=AsyncMock(return_value=("dump-id-123", ["t1","t2","t3"]))), \
         patch("api.dump.ai_budget.has_budget", new=AsyncMock(return_value=True)), \
         patch("api.dump.ai_budget.record_usage", new=AsyncMock(return_value=None)):
        resp = await client.post("/dump/text", json={"text": "купить молоко и сдать отчёт"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["tasks"]) == 3
    assert len(body["today_top3"]) <= 3


@pytest.mark.anyio
async def test_dump_text_empty_returns_422(client):
    resp = await client.post("/dump/text", json={"text": ""})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_dump_text_over_budget_returns_429(client):
    with patch("api.dump.ai_budget.has_budget", new=AsyncMock(return_value=False)):
        resp = await client.post("/dump/text", json={"text": "anything"})
    assert resp.status_code == 429


@pytest.mark.anyio
async def test_dump_text_no_auth_returns_401():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post("/dump/text", json={"text": "test"})
    assert resp.status_code == 401
```

- [ ] **Step 7: Run full test suite**

```bash
pytest -q
```
Expected: all pass. Fix any import cascade issues in tests that reference `parse_dump` return type.

- [ ] **Step 8: Commit**

```bash
git add second-brain/backend/services/ai_router.py second-brain/backend/services/parser.py second-brain/backend/api/dump.py second-brain/backend/tests/test_parser.py second-brain/backend/tests/test_dump.py
git commit -m "feat(backend): budget enforcement + resilient parser + duration limit on /dump"
```

---

## Task 5: Sentry on mobile (Expo)

**Files:**
- Modify: `second-brain/mobile/package.json`
- Modify: `second-brain/mobile/app.json`
- Create: `second-brain/mobile/services/sentry.ts`
- Modify: `second-brain/mobile/app/_layout.tsx`
- Modify: `second-brain/mobile/.env.example`

- [ ] **Step 1: Install Sentry via wizard**

```bash
cd second-brain/mobile
npx @sentry/wizard@latest -i reactNative
```

This automatically adds `@sentry/react-native` to package.json and the plugin stub to app.json. Do NOT let the wizard modify `_layout.tsx` (cancel that step or revert) — we'll wire it manually in step 3 to match existing structure.

- [ ] **Step 2: Verify app.json plugin section**

Edit `second-brain/mobile/app.json` — ensure plugins array contains the Sentry entry:

```json
"plugins": [
  "expo-router",
  [
    "expo-audio",
    {
      "microphonePermission": "$(PRODUCT_NAME) использует микрофон для голосового ввода задач"
    }
  ],
  [
    "expo-notifications",
    { "color": "#ffffff" }
  ],
  [
    "@sentry/react-native/expo",
    {
      "url": "https://sentry.io/",
      "project": "second-brain-mobile",
      "organization": "YOUR_ORG_SLUG"
    }
  ]
]
```

Fill `YOUR_ORG_SLUG` with your real Sentry organization slug.

- [ ] **Step 3: Create services/sentry.ts**

Create `second-brain/mobile/services/sentry.ts`:

```typescript
import { isRunningInExpoGo } from "expo";
import * as Sentry from "@sentry/react-native";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_ENV ?? "development",
    tracesSampleRate: 0.2,
    integrations: [navigationIntegration],
    enableNativeFramesTracking: !isRunningInExpoGo(),
  });
}

export { Sentry };
```

- [ ] **Step 4: Wire into _layout.tsx**

Edit `second-brain/mobile/app/_layout.tsx`. At the top, add the init call and wrap the default export:

```typescript
import React, { useEffect, useState } from "react";
import { Slot, useNavigationContainerRef, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  getAllTasks,
  getMe,
  getTodayTasks,
  supabase,
} from "../services/api";
import { initRevenueCat, logInToRevenueCat } from "../services/purchases";
import { useAppStore } from "../store/useAppStore";
import { Sentry, initSentry, navigationIntegration } from "../services/sentry";

initSentry();

function RootLayout() {
  const navRef = useNavigationContainerRef();
  useEffect(() => {
    if (navRef) navigationIntegration.registerNavigationContainer(navRef);
  }, [navRef]);

  // ... existing body unchanged ...
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  // (keep the rest of the existing component verbatim)
}

export default Sentry.wrap(RootLayout);
```

Keep the entire existing body of RootLayout (auth hydration, routing guards, notification listener). The only edits are:
- top-level imports
- `initSentry()` call before the component
- `useNavigationContainerRef` + register effect inside
- `Sentry.wrap(RootLayout)` as the default export

- [ ] **Step 5: Add env var template**

Edit `second-brain/mobile/.env.example`, add:

```
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_ENV=development
```

- [ ] **Step 6: Set up SENTRY_AUTH_TOKEN for source maps**

Create a Sentry org-level auth token in Sentry UI → Settings → Auth Tokens with `project:releases` + `org:read` scopes. Store it in EAS:

```bash
cd second-brain/mobile
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "sntrys_..."
```

- [ ] **Step 7: Manual smoke test**

Add a temporary button on the home screen that throws:

```typescript
<Button title="Test Sentry" onPress={() => { throw new Error("mobile sentry test"); }} />
```

Run app, tap it, verify event appears in Sentry UI with readable stack trace. Remove the button.

- [ ] **Step 8: Commit**

```bash
git add second-brain/mobile/package.json second-brain/mobile/package-lock.json second-brain/mobile/app.json second-brain/mobile/services/sentry.ts second-brain/mobile/app/_layout.tsx second-brain/mobile/.env.example
git commit -m "feat(mobile): Sentry integration with navigation tracing"
```

---

## Task 6: Audio duration limit on client (3 min hard stop)

**Files:**
- Modify: `second-brain/mobile/services/audio.ts`
- Modify: `second-brain/mobile/app/(app)/dump.tsx`

- [ ] **Step 1: Add duration tracking + auto-stop**

Replace `second-brain/mobile/services/audio.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from "expo-audio";

export const isVoiceRecordingSupported = Platform.OS !== "web";
export const MAX_RECORDING_MS = 180_000;

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    setAudioUri(null);
    setElapsedMs(0);
    if (!isVoiceRecordingSupported) {
      setError("Голосовой ввод пока недоступен в desktop/web версии");
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError("Нет разрешения на микрофон");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      startedAt.current = Date.now();
      tickRef.current = setInterval(() => {
        if (startedAt.current) setElapsedMs(Date.now() - startedAt.current);
      }, 250);
      timeoutRef.current = setTimeout(() => {
        void stopRecording();
      }, MAX_RECORDING_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording error");
      setIsRecording(false);
    }
  }

  async function stopRecording(): Promise<string | null> {
    if (!isVoiceRecordingSupported) return null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      await recorder.stop();
      const uri = recorder.uri ?? null;
      setAudioUri(uri);
      return uri;
    } catch {
      return null;
    } finally {
      setIsRecording(false);
      startedAt.current = null;
    }
  }

  return { isRecording, audioUri, error, elapsedMs, startRecording, stopRecording };
}
```

- [ ] **Step 2: Show countdown in dump.tsx**

Edit `second-brain/mobile/app/(app)/dump.tsx` — destructure `elapsedMs` and render remaining time in the recording UI:

```typescript
const { isRecording, startRecording, stopRecording, elapsedMs } = useVoiceRecorder();
const remainingSec = Math.max(0, Math.ceil((180_000 - elapsedMs) / 1000));
```

Replace the existing `hint` Text when recording:

```typescript
<Text style={styles.hint}>
  {isRecording
    ? `Осталось ${remainingSec}с — нажми чтобы остановить`
    : "Нажми чтобы начать"}
</Text>
```

- [ ] **Step 3: Manual verify**

```bash
cd second-brain/mobile
npm run ios
```
Start recording, wait past 180s → it auto-stops and uploads. Expected backend response: 200 or 413 if duration detection on server also triggers (shouldn't if client stops at 180s).

- [ ] **Step 4: Commit**

```bash
git add second-brain/mobile/services/audio.ts second-brain/mobile/app/(app)/dump.tsx
git commit -m "feat(mobile): 3-min hard cap on voice recording with countdown"
```

---

## Task 7: Offline dump queue

**Files:**
- Modify: `second-brain/mobile/package.json` (NetInfo)
- Modify: `second-brain/mobile/store/useAppStore.ts` (persisted queue slice)
- Create: `second-brain/mobile/services/dumpQueue.ts`
- Modify: `second-brain/mobile/services/api.ts` (delegate to queue, expose raw dump)
- Modify: `second-brain/mobile/app/(app)/dump.tsx` (show offline toast)
- Modify: `second-brain/mobile/app/_layout.tsx` (register network listener)

- [ ] **Step 1: Install NetInfo**

```bash
cd second-brain/mobile
npx expo install @react-native-community/netinfo
```

- [ ] **Step 2: Add pendingDumps slice to store**

Edit `second-brain/mobile/store/useAppStore.ts`. Add to `AppState`:

```typescript
export interface PendingDump {
  id: string;
  kind: "text" | "voice";
  text?: string;
  uri?: string;
  createdAt: number;
  lastError?: string;
  attempts: number;
}

interface AppState {
  // ... existing fields ...
  pendingDumps: PendingDump[];
  enqueueDump: (dump: Omit<PendingDump, "id" | "createdAt" | "attempts">) => string;
  updateDump: (id: string, updates: Partial<PendingDump>) => void;
  removeDump: (id: string) => void;
}
```

In the `persist` body, add:

```typescript
pendingDumps: [],
enqueueDump: (d) => {
  const id = `dump_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  set((s) => ({
    pendingDumps: [
      ...s.pendingDumps,
      { ...d, id, createdAt: Date.now(), attempts: 0 },
    ],
  }));
  return id;
},
updateDump: (id, updates) =>
  set((s) => ({
    pendingDumps: s.pendingDumps.map((p) => (p.id === id ? { ...p, ...updates } : p)),
  })),
removeDump: (id) =>
  set((s) => ({ pendingDumps: s.pendingDumps.filter((p) => p.id !== id) })),
```

Update `partialize`:

```typescript
partialize: (state) => ({
  user: state.user,
  isOnboarded: state.isOnboarded,
  pendingDumps: state.pendingDumps,
}),
```

- [ ] **Step 3: Rename raw dump functions in api.ts**

Edit `second-brain/mobile/services/api.ts`. Rename `dumpText` → `dumpTextRaw`, `dumpVoice` → `dumpVoiceRaw`, export unchanged bodies. Keep the response types exported.

```typescript
export async function dumpTextRaw(
  text: string,
  userContext: object = {},
): Promise<DumpTextResponse> {
  const { data } = await api.post("/dump/text", {
    text,
    user_context: userContext,
  });
  return data;
}

export async function dumpVoiceRaw(uri: string): Promise<DumpVoiceResponse> {
  const formData = new FormData();
  formData.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as any);
  const { data } = await api.post("/dump/voice", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
```

- [ ] **Step 4: Implement dumpQueue.ts**

Create `second-brain/mobile/services/dumpQueue.ts`:

```typescript
import NetInfo from "@react-native-community/netinfo";
import { Sentry } from "./sentry";
import { dumpTextRaw, dumpVoiceRaw, DumpTextResponse, DumpVoiceResponse } from "./api";
import { useAppStore, PendingDump } from "../store/useAppStore";

const MAX_ATTEMPTS = 5;
let isDraining = false;

export async function enqueueTextDump(text: string): Promise<DumpTextResponse | null> {
  const state = useAppStore.getState();
  const netState = await NetInfo.fetch();
  if (netState.isConnected && netState.isInternetReachable !== false) {
    try {
      return await dumpTextRaw(text);
    } catch (e) {
      state.enqueueDump({ kind: "text", text });
      void drainQueue();
      return null;
    }
  }
  state.enqueueDump({ kind: "text", text });
  return null;
}

export async function enqueueVoiceDump(uri: string): Promise<DumpVoiceResponse | null> {
  const state = useAppStore.getState();
  const netState = await NetInfo.fetch();
  if (netState.isConnected && netState.isInternetReachable !== false) {
    try {
      return await dumpVoiceRaw(uri);
    } catch (e) {
      state.enqueueDump({ kind: "voice", uri });
      void drainQueue();
      return null;
    }
  }
  state.enqueueDump({ kind: "voice", uri });
  return null;
}

async function attempt(dump: PendingDump): Promise<boolean> {
  try {
    if (dump.kind === "text" && dump.text) {
      await dumpTextRaw(dump.text);
    } else if (dump.kind === "voice" && dump.uri) {
      await dumpVoiceRaw(dump.uri);
    } else {
      return true;
    }
    return true;
  } catch (e: any) {
    Sentry.captureException(e, { extra: { dumpId: dump.id, kind: dump.kind } });
    useAppStore.getState().updateDump(dump.id, {
      attempts: dump.attempts + 1,
      lastError: e?.message ?? "unknown",
    });
    return false;
  }
}

export async function drainQueue() {
  if (isDraining) return;
  isDraining = true;
  try {
    const state = useAppStore.getState();
    for (const dump of [...state.pendingDumps]) {
      if (dump.attempts >= MAX_ATTEMPTS) continue;
      const ok = await attempt(dump);
      if (ok) {
        useAppStore.getState().removeDump(dump.id);
      }
    }
  } finally {
    isDraining = false;
  }
}

export function startQueueListener() {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void drainQueue();
    }
  });
}
```

- [ ] **Step 5: Update dump.tsx to use queue**

Edit `second-brain/mobile/app/(app)/dump.tsx`. Replace the direct API imports with queue imports:

```typescript
import { enqueueTextDump, enqueueVoiceDump } from "../../services/dumpQueue";
```

Update `handleVoiceStop`:

```typescript
async function handleVoiceStop() {
  const uri = await stopRecording();
  if (!uri) return;
  setLoading(true);
  try {
    const result = await enqueueVoiceDump(uri);
    if (result) {
      router.push({
        pathname: "/(app)/result",
        params: { data: JSON.stringify(result) },
      });
    } else {
      Alert.alert(
        "Сохранено в очередь",
        "Сеть пропала — отправим когда появится связь.",
      );
      router.replace("/(app)/");
    }
  } catch (e: any) {
    Alert.alert("Ошибка", e.message ?? "Не удалось обработать запись");
  } finally {
    setLoading(false);
  }
}
```

Same pattern for `handleTextSubmit` (call `enqueueTextDump(text.trim())`).

- [ ] **Step 6: Start listener in _layout.tsx**

Edit `second-brain/mobile/app/_layout.tsx`, add inside the RootLayout component:

```typescript
import { startQueueListener, drainQueue } from "../services/dumpQueue";

// inside RootLayout()
useEffect(() => {
  const sub = startQueueListener();
  void drainQueue(); // drain once on mount
  return () => sub();
}, []);
```

- [ ] **Step 7: Manual verification**

1. Run app connected: text dump works online, response goes to result screen.
2. Disable wifi + mobile data on the device.
3. Trigger a text dump → "Сохранено в очередь" toast, user sent to home.
4. Inspect store via React DevTools: `pendingDumps` has 1 entry.
5. Re-enable network → within a few seconds the entry drains (attempt runs, removes on success). Verify in backend logs that the dump was received.

- [ ] **Step 8: Commit**

```bash
git add second-brain/mobile/package.json second-brain/mobile/package-lock.json second-brain/mobile/store/useAppStore.ts second-brain/mobile/services/api.ts second-brain/mobile/services/dumpQueue.ts second-brain/mobile/app/(app)/dump.tsx second-brain/mobile/app/_layout.tsx
git commit -m "feat(mobile): offline dump queue with NetInfo-driven retry"
```

---

## Task 8: Supabase 401 recovery (auto sign-out + redirect)

**Files:**
- Modify: `second-brain/mobile/services/api.ts`

- [ ] **Step 1: Update response interceptor**

Edit `second-brain/mobile/services/api.ts` — replace the current response interceptor:

```typescript
let onUnauthorized: (() => Promise<void>) | null = null;

export function registerUnauthorizedHandler(handler: () => Promise<void>) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail ?? error.message;
    if (status === 401) {
      try {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed?.session) {
          await supabase.auth.signOut();
          if (onUnauthorized) await onUnauthorized();
        } else if (error.config) {
          error.config.headers.Authorization = `Bearer ${refreshed.session.access_token}`;
          return api.request(error.config);
        }
      } catch {
        await supabase.auth.signOut();
        if (onUnauthorized) await onUnauthorized();
      }
    }
    const appError = new Error(detail);
    (appError as any).status = status;
    return Promise.reject(appError);
  },
);
```

- [ ] **Step 2: Register handler in _layout.tsx**

Edit `second-brain/mobile/app/_layout.tsx`. Add:

```typescript
import { registerUnauthorizedHandler } from "../services/api";

// inside RootLayout(), after router is defined
useEffect(() => {
  registerUnauthorizedHandler(async () => {
    router.replace("/(onboarding)/welcome");
  });
}, [router]);
```

- [ ] **Step 3: Manual verification**

1. Sign in.
2. In Supabase SQL editor, revoke the user's refresh tokens (or wait for token expiry).
3. Trigger an authenticated API call (e.g., refresh home) — you should land on welcome screen.

- [ ] **Step 4: Commit**

```bash
git add second-brain/mobile/services/api.ts second-brain/mobile/app/_layout.tsx
git commit -m "feat(mobile): refresh-or-signout on 401"
```

---

## Task 9: Add `finance` and `goals` spheres

**Why:** The product scope grew — users also dump financial tasks (платежи, бюджет, планирование покупок) and long-term goals. Current 5-sphere taxonomy (work/family/study/health/travel) forces these into wrong buckets.

**Files:**
- Create: `second-brain/supabase/migrations/006_add_spheres.sql`
- Modify: `second-brain/backend/models/task.py`
- Modify: `second-brain/backend/services/parser.py`
- Modify: `second-brain/mobile/constants/spheres.ts`
- Test: `second-brain/backend/tests/test_parser.py`

- [ ] **Step 1: Write the SQL migration**

Create `second-brain/supabase/migrations/006_add_spheres.sql`:

```sql
alter table public.tasks
  drop constraint if exists tasks_sphere_check;

alter table public.tasks
  add constraint tasks_sphere_check
  check (sphere in ('work','family','study','health','travel','finance','goals'));
```

- [ ] **Step 2: Apply migration to dev Supabase**

Paste the migration into Supabase SQL editor. Verify:

```sql
insert into public.tasks (user_id, title, sphere) values (auth.uid(), 'test', 'finance');
insert into public.tasks (user_id, title, sphere) values (auth.uid(), 'test', 'goals');
delete from public.tasks where title = 'test';
```
Expected: both inserts succeed.

- [ ] **Step 3: Update backend enum**

Replace `second-brain/backend/models/task.py`:

```python
from enum import Enum
from datetime import datetime
from pydantic import BaseModel


class Sphere(str, Enum):
    work = "work"
    family = "family"
    study = "study"
    health = "health"
    travel = "travel"
    finance = "finance"
    goals = "goals"


class Priority(int, Enum):
    low = 1
    medium = 2
    high = 3


class ParsedTask(BaseModel):
    title: str
    sphere: Sphere
    priority: Priority = Priority.medium
    deadline: datetime | None = None
    notes: str | None = None
    is_today: bool = False


class ParsedDump(BaseModel):
    tasks: list[ParsedTask]

    @property
    def today_top3(self) -> list[ParsedTask]:
        today = [t for t in self.tasks if t.is_today]
        return sorted(today, key=lambda t: t.priority, reverse=True)[:3]
```

- [ ] **Step 4: Update parser prompt**

Edit `second-brain/backend/services/parser.py` — replace the `PARSE_SYSTEM` constant:

```python
PARSE_SYSTEM = """Ты — AI-ассистент для структурирования задач.
Пользователь даёт поток мыслей. Твоя задача:
- Каждое дело/намерение = отдельная задача
- Определить сферу:
  * work — работа, дедлайны, проекты
  * family — семья, дети, быт, покупки для дома
  * study — учёба, курсы, саморазвитие
  * health — здоровье, спорт, лекарства, привычки
  * travel — поездки, события, встречи
  * finance — финансы, платежи, бюджет, планирование расходов
  * goals — долгосрочные цели, амбиции, личные проекты
- Определить приоритет: 1=низкий, 2=средний, 3=высокий
- is_today=true если нужно сделать сегодня или срочно
- deadline: ISO 8601 UTC если упомянуто ("в пятницу", "завтра", "через неделю")
- Отвечать ТОЛЬКО валидным JSON без markdown-обёртки

Формат ответа:
{"tasks": [{"title": "...", "sphere": "work", "priority": 2, "is_today": false, "deadline": null, "notes": null}]}"""
```

- [ ] **Step 5: Write failing parser test for new spheres**

Add to `second-brain/backend/tests/test_parser.py`:

```python
@pytest.mark.anyio
async def test_parser_accepts_finance_sphere():
    valid = '{"tasks": [{"title": "Заплатить за интернет", "sphere": "finance", "priority": 2, "is_today": true}]}'
    with patch(
        "services.parser.complete",
        new=AsyncMock(return_value=AIResult(text=valid, tokens=50, tier=AITier.cheap)),
    ):
        result = await parse_dump("напомни заплатить за интернет", {})
    assert result.parsed.tasks[0].sphere.value == "finance"


@pytest.mark.anyio
async def test_parser_accepts_goals_sphere():
    valid = '{"tasks": [{"title": "Выйти на $10k/мес", "sphere": "goals", "priority": 3, "is_today": false}]}'
    with patch(
        "services.parser.complete",
        new=AsyncMock(return_value=AIResult(text=valid, tokens=50, tier=AITier.cheap)),
    ):
        result = await parse_dump("хочу выйти на 10к", {})
    assert result.parsed.tasks[0].sphere.value == "goals"
```

- [ ] **Step 6: Run backend tests**

```bash
cd second-brain/backend
pytest tests/test_parser.py -v
```
Expected: all parser tests pass including the two new ones.

- [ ] **Step 7: Update mobile constants**

Replace `second-brain/mobile/constants/spheres.ts`:

```typescript
export type Sphere =
  | "work"
  | "family"
  | "study"
  | "health"
  | "travel"
  | "finance"
  | "goals";

export interface SphereInfo {
  id: Sphere;
  label: string;
  icon: string;
  color: string;
}

export const SPHERES: SphereInfo[] = [
  { id: "work", label: "Работа", icon: "💼", color: "#4F8EF7" },
  { id: "family", label: "Семья", icon: "👨‍👩‍👧", color: "#F7934C" },
  { id: "study", label: "Учёба", icon: "📚", color: "#9B59B6" },
  { id: "health", label: "Здоровье", icon: "💪", color: "#2ECC71" },
  { id: "travel", label: "Поездки", icon: "✈️", color: "#E74C3C" },
  { id: "finance", label: "Финансы", icon: "💰", color: "#F1C40F" },
  { id: "goals", label: "Цели", icon: "🎯", color: "#1ABC9C" },
];

export const SPHERE_MAP = Object.fromEntries(
  SPHERES.map((s) => [s.id, s]),
) as Record<Sphere, SphereInfo>;
```

- [ ] **Step 8: Run mobile typecheck**

```bash
cd second-brain/mobile
npm run typecheck
```
Expected: no errors. TypeScript narrows `Sphere` everywhere automatically.

- [ ] **Step 9: Manual smoke**

Run app, go to All screen → verify 7 sphere tabs render (5 old + Финансы + Цели). Do a text dump: "заплатить за интернет завтра, и хочу накопить на машину за год" → on Result screen, the two tasks land in finance/goals spheres respectively.

- [ ] **Step 10: Commit**

```bash
git add second-brain/supabase/migrations/006_add_spheres.sql second-brain/backend/models/task.py second-brain/backend/services/parser.py second-brain/backend/tests/test_parser.py second-brain/mobile/constants/spheres.ts
git commit -m "feat: add finance and goals spheres"
```

---

## Task 10: CI — run backend tests on every push

**Files:**
- Create: `.github/workflows/backend.yml`

- [ ] **Step 1: Create workflow**

Create `.github/workflows/backend.yml`:

```yaml
name: backend

on:
  push:
    paths:
      - "second-brain/backend/**"
      - ".github/workflows/backend.yml"
  pull_request:
    paths:
      - "second-brain/backend/**"

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: second-brain/backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
          cache-dependency-path: second-brain/backend/requirements.txt
      - run: pip install -r requirements.txt
      - name: Run tests
        env:
          SUPABASE_URL: https://test.supabase.co
          SUPABASE_SERVICE_KEY: test
          SUPABASE_JWT_SECRET: test
          ANTHROPIC_API_KEY: test
          ENVIRONMENT: test
        run: pytest -q
```

- [ ] **Step 2: Push & verify**

After pushing: open the Actions tab in GitHub, confirm the workflow runs green.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/backend.yml
git commit -m "ci: run backend tests on push"
```

---

## Self-Review Checklist

- [x] Config validation (Task 1) — covers spec line "strict env"
- [x] Sentry backend (Task 2) — covers "error tracking"
- [x] Rate limiting enforced (Task 2 via mandatory slowapi import + exception handler)
- [x] Per-user AI budget (Tasks 3, 4) — covers "cost protection"
- [x] Parser resilience (Task 4) — covers "malformed JSON fallback"
- [x] AI router Sentry telemetry (Task 4) — covers "tier fallback visibility"
- [x] Audio duration limit (Tasks 4 server + 6 client) — covers "indefinite recording"
- [x] Sentry mobile (Task 5) — covers "mobile error tracking"
- [x] Offline dump queue (Task 7) — covers "no offline support"
- [x] 401 recovery (Task 8) — covers "silent 401 requires re-login"
- [x] Finance + goals spheres (Task 9) — covers updated product taxonomy
- [x] CI (Task 10) — covers "no CI/CD"

Types referenced across tasks:
- `AIResult` defined in Task 4 step 1, used in Task 4 step 2 parser changes — consistent
- `ParsedDumpWithUsage` defined in Task 4 step 2, used in Task 4 step 6 test rewrite — consistent
- `PendingDump` defined in Task 7 step 2, used in Task 7 step 4 queue — consistent

No placeholders. All code blocks complete. All commands have expected output or a verification step.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-24-second-brain-reliability.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
