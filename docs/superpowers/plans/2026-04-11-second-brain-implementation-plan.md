# Second Brain — Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile + web AI assistant that converts chaotic voice/text dumps into structured task lists with persistent semantic memory.

**Architecture:** React Native (Expo SDK 53 + Expo Router v4) — single codebase iOS/Android/Web. FastAPI backend with 3-tier LLM router (Groq Llama → Claude Haiku → Claude Sonnet). Supabase = PostgreSQL + pgvector (HNSW + halfvec) + Auth. Redis for caching and rate limiting.

**Tech Stack:** Python 3.12, FastAPI, Supabase (PostgreSQL + pgvector + Auth), Redis, OpenAI gpt-4o-mini-transcribe (STT), Groq Llama 3.3 70B, Anthropic Claude Haiku 4.5 + Sonnet 4.6, React Native, Expo SDK 53, Expo Router v4, Zustand + MMKV, RevenueCat, Railway.

> ⚠️ **Key corrections from tech research (apply throughout):**
> - Audio: `expo-audio` + `useAudioRecorder` — NOT `expo-av` (deprecated)
> - STT model: `gpt-4o-mini-transcribe` — NOT `whisper-1`
> - pgvector: `halfvec(1536)` + HNSW index — NOT `vector(1536)` + ivfflat
> - Auth: real PyJWT decode — NOT `user_id = "demo-user"`
> - State: Zustand + MMKV — NOT AsyncStorage
> - AI Router: retry + fallback chain — NOT single-provider

---

## File Map

```
second-brain/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, rate limiter, router mounts
│   ├── config.py               # Pydantic Settings (all env vars)
│   ├── database.py             # Supabase client singleton
│   ├── auth.py                 # get_current_user_id dependency (PyJWT)
│   ├── api/
│   │   ├── dump.py             # POST /dump/text, POST /dump/voice
│   │   ├── tasks.py            # GET /tasks/today, GET /tasks/, PATCH, DELETE
│   │   ├── auth.py             # GET /auth/me, POST /auth/profile
│   │   └── memory.py           # POST /memory/search, GET /memory/profile
│   ├── services/
│   │   ├── stt.py              # transcribe_audio + HuggingFace fallback
│   │   ├── ai_router.py        # complete() with retry + 3-tier fallback
│   │   ├── parser.py           # parse_dump() text → ParsedDump
│   │   └── memory_store.py     # save_memory() + search_relevant_memory()
│   ├── models/
│   │   └── task.py             # Sphere, Priority enums; ParsedTask, ParsedDump
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
│       ├── conftest.py
│       ├── test_stt.py
│       ├── test_parser.py
│       ├── test_dump.py
│       └── test_tasks.py
├── supabase/
│   └── migrations/
│       ├── 001_init.sql        # user_profiles, dumps, tasks (RLS + indexes + trigger)
│       ├── 002_memory_hnsw.sql # memory_embeddings (halfvec + HNSW)
│       └── 003_memory_rpc.sql  # match_memories() RPC
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx         # Root: auth guard + RevenueCat init
│   │   ├── (onboarding)/
│   │   │   ├── _layout.tsx
│   │   │   ├── welcome.tsx
│   │   │   ├── setup.tsx
│   │   │   └── first-dump.tsx
│   │   └── (app)/
│   │       ├── _layout.tsx     # Tab navigator
│   │       ├── index.tsx       # Home: top 3 today
│   │       ├── dump.tsx        # Voice/text input
│   │       ├── result.tsx      # Parsed tasks by sphere
│   │       ├── all.tsx         # All tasks + sphere filter
│   │       ├── task/[id].tsx   # Task detail editor
│   │       └── profile.tsx     # User + premium
│   ├── components/
│   │   ├── TaskCard.tsx
│   │   ├── VoiceWave.tsx
│   │   ├── SphereTab.tsx
│   │   └── DumpButton.tsx
│   ├── services/
│   │   ├── api.ts              # Axios instance + typed API functions
│   │   ├── audio.ts            # useVoiceRecorder hook (expo-audio)
│   │   ├── notifications.ts    # scheduleReminder, requestPushPermission
│   │   └── purchases.ts        # RevenueCat initRevenueCat, isPremium, buyPremium
│   ├── store/
│   │   └── useAppStore.ts      # Zustand + MMKV
│   ├── constants/
│   │   └── spheres.ts
│   └── .env.example
├── .env.example
└── .env.railway
```

---

## Task 1: Backend Foundation

**Files:**
- Create: `supabase/migrations/001_init.sql`
- Create: `backend/config.py`
- Create: `backend/database.py`
- Create: `backend/main.py`
- Create: `backend/requirements.txt`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write `supabase/migrations/001_init.sql`**

```sql
create extension if not exists vector;

-- User profiles (extends Supabase auth.users)
create table public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  language text default 'ru',
  role text check (role in ('mom','freelancer','student','entrepreneur','other')),
  living_with text check (living_with in ('alone','couple','with_kids')),
  peak_hours text check (peak_hours in ('morning','afternoon','evening')),
  created_at timestamptz default now()
);
alter table public.user_profiles enable row level security;
create policy "users_own_profile" on public.user_profiles
  for all using (auth.uid() = id);

-- Raw audio/text dumps (history + reprocessing)
create table public.dumps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  raw_text text,
  audio_url text,
  status text default 'done' check (status in ('processing','done','failed')),
  created_at timestamptz default now()
);
alter table public.dumps enable row level security;
create policy "users_own_dumps" on public.dumps
  for all using (auth.uid() = user_id);
create index dumps_user_created_idx on public.dumps (user_id, created_at desc);

-- Tasks
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  dump_id uuid references public.dumps(id) on delete set null,
  title text not null,
  notes text,
  sphere text check (sphere in ('work','family','study','health','travel')),
  priority int default 2 check (priority in (1,2,3)),
  deadline timestamptz,
  reminder_at timestamptz,
  is_done boolean default false,
  is_today boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.tasks enable row level security;
create policy "users_own_tasks" on public.tasks
  for all using (auth.uid() = user_id);

create index tasks_today_idx on public.tasks (user_id, is_today, is_done) where is_done = false;
create index tasks_sphere_idx on public.tasks (user_id, sphere, is_done) where is_done = false;
create index tasks_priority_idx on public.tasks (user_id, priority desc, created_at desc);

-- Auto-update updated_at on tasks
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Write `supabase/migrations/002_memory_hnsw.sql`**

```sql
-- halfvec uses half-precision floats: 2x less storage than vector
create table public.memory_embeddings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  embedding halfvec(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
alter table public.memory_embeddings enable row level security;
create policy "users_own_memory" on public.memory_embeddings
  for all using (auth.uid() = user_id);

-- HNSW: better recall than ivfflat, no vacuum needed after inserts
create index memory_hnsw_idx on public.memory_embeddings
  using hnsw (embedding halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);
```

- [ ] **Step 3: Write `supabase/migrations/003_memory_rpc.sql`**

```sql
create or replace function match_memories(
  user_id_input uuid,
  query_embedding halfvec(1536),
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (content text, similarity float)
language sql stable as $$
  select
    content,
    1 - (embedding <=> query_embedding) as similarity
  from public.memory_embeddings
  where
    user_id = user_id_input
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

- [ ] **Step 4: Apply migrations**

```bash
cd second-brain
supabase db push
```
Expected: all 3 migrations apply without errors.

- [ ] **Step 5: Write `backend/requirements.txt`**

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
pytest==8.3.3
pytest-asyncio==0.24.0
```

- [ ] **Step 6: Write `backend/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    openai_api_key: str
    groq_api_key: str
    anthropic_api_key: str
    huggingface_api_key: str = ""
    redis_url: str = "redis://localhost:6379"
    environment: str = "development"
    allowed_origins: str = "http://localhost:8081"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
```

- [ ] **Step 7: Write `backend/database.py`**

```python
from supabase import create_client, Client
from config import settings

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
```

- [ ] **Step 8: Write `backend/auth.py`**

```python
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings

_bearer = HTTPBearer(auto_error=False)

async def get_current_user_id(
    cred: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    if cred is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    try:
        payload = jwt.decode(
            cred.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
```

- [ ] **Step 9: Write `backend/main.py`**

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from config import settings
from api import dump, tasks, auth, memory

app = FastAPI(title="Second Brain API")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
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
```

- [ ] **Step 10: Write `backend/tests/conftest.py`**

```python
import pytest
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport
from main import app
import auth

TEST_USER_ID = "test-user-uuid-1234"

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client(monkeypatch):
    monkeypatch.setattr(auth, "get_current_user_id", AsyncMock(return_value=TEST_USER_ID))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.fixture
def test_user_id():
    return TEST_USER_ID
```

- [ ] **Step 11: Create stub API files so imports resolve**

Create `backend/api/__init__.py` (empty), then stub routers:

```python
# backend/api/dump.py (stub)
from fastapi import APIRouter
router = APIRouter()

# backend/api/tasks.py (stub)
from fastapi import APIRouter
router = APIRouter()

# backend/api/auth.py (stub)
from fastapi import APIRouter
router = APIRouter()

# backend/api/memory.py (stub)
from fastapi import APIRouter
router = APIRouter()
```

- [ ] **Step 12: Verify health endpoint**

```bash
cd backend && uvicorn main:app --port 8000 &
curl http://localhost:8000/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 13: Commit**

```bash
git add supabase/ backend/
git commit -m "feat: backend foundation — Supabase schema + FastAPI skeleton"
```

---

## Task 2: STT Service (TDD)

**Files:**
- Create: `backend/tests/test_stt.py`
- Create: `backend/services/stt.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_stt.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.anyio
async def test_transcribe_returns_text():
    mock_response = "купить молоко завтра вечером"
    with patch("services.stt.openai_client") as mock_client:
        mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_response)
        from services.stt import transcribe_audio
        result = await transcribe_audio(b"fake-audio-bytes", "audio.m4a")
    assert result == mock_response

@pytest.mark.anyio
async def test_transcribe_empty_audio_raises():
    from services.stt import transcribe_audio
    with pytest.raises(ValueError, match="empty"):
        await transcribe_audio(b"", "audio.m4a")

@pytest.mark.anyio
async def test_transcribe_with_fallback_on_openai_error():
    with patch("services.stt.openai_client") as mock_openai, \
         patch("services.stt._transcribe_via_huggingface", new=AsyncMock(return_value="fallback text")):
        mock_openai.audio.transcriptions.create = AsyncMock(side_effect=Exception("rate limit"))
        from services.stt import transcribe_audio_with_fallback
        result = await transcribe_audio_with_fallback(b"audio", "audio.m4a")
    assert result == "fallback text"
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
cd backend && pytest tests/test_stt.py -v
```
Expected: `ModuleNotFoundError: No module named 'services.stt'`

- [ ] **Step 3: Write `backend/services/stt.py`**

```python
import io
import httpx
from openai import AsyncOpenAI
from config import settings

openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
_SUPPORTED_FORMATS = {"m4a", "mp3", "wav", "webm", "ogg"}
_HF_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3"

async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.m4a",
    language: str | None = None,
) -> str:
    if not audio_bytes:
        raise ValueError("Cannot transcribe empty audio")

    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in _SUPPORTED_FORMATS:
        ext = "m4a"

    buf = io.BytesIO(audio_bytes)
    buf.name = f"audio.{ext}"

    kwargs = {
        "model": "gpt-4o-mini-transcribe",
        "file": buf,
        "response_format": "text",
        "prompt": "Задачи, дедлайны, встречи, покупки, напоминания.",
    }
    if language:
        kwargs["language"] = language

    return await openai_client.audio.transcriptions.create(**kwargs)

async def _transcribe_via_huggingface(audio_bytes: bytes) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _HF_URL,
            content=audio_bytes,
            headers={
                "Authorization": f"Bearer {settings.huggingface_api_key}",
                "Content-Type": "audio/m4a",
            },
        )
        resp.raise_for_status()
        return resp.json().get("text", "")

async def transcribe_audio_with_fallback(
    audio_bytes: bytes, filename: str = "audio.m4a"
) -> str:
    try:
        return await transcribe_audio(audio_bytes, filename)
    except Exception:
        return await _transcribe_via_huggingface(audio_bytes)
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
pytest tests/test_stt.py -v
```
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/services/stt.py backend/tests/test_stt.py
git commit -m "feat: STT service — gpt-4o-mini-transcribe + HuggingFace fallback"
```

---

## Task 3: AI Router (TDD)

**Files:**
- Create: `backend/services/ai_router.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_ai_router.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.anyio
async def test_complete_returns_text_from_groq():
    with patch("services.ai_router.groq_client") as mock_groq:
        mock_choice = AsyncMock()
        mock_choice.message.content = "parsed result"
        mock_groq.chat.completions.create = AsyncMock(
            return_value=AsyncMock(choices=[mock_choice])
        )
        from services.ai_router import complete, AITier
        result = await complete("system prompt", "user input", tier=AITier.cheap)
    assert result == "parsed result"

@pytest.mark.anyio
async def test_complete_falls_back_to_anthropic_on_groq_failure():
    with patch("services.ai_router.groq_client") as mock_groq, \
         patch("services.ai_router.anthropic_client") as mock_anthropic:
        mock_groq.chat.completions.create = AsyncMock(side_effect=Exception("groq down"))
        mock_content = AsyncMock()
        mock_content.text = "fallback result"
        mock_anthropic.messages.create = AsyncMock(
            return_value=AsyncMock(content=[mock_content])
        )
        from services.ai_router import complete, AITier
        result = await complete("system", "user", tier=AITier.cheap, retries=0)
    assert result == "fallback result"

@pytest.mark.anyio
async def test_complete_raises_when_all_tiers_fail():
    with patch("services.ai_router.groq_client") as mg, \
         patch("services.ai_router.anthropic_client") as ma:
        mg.chat.completions.create = AsyncMock(side_effect=Exception("groq down"))
        ma.messages.create = AsyncMock(side_effect=Exception("anthropic down"))
        from services.ai_router import complete, AITier
        with pytest.raises(RuntimeError, match="All AI providers failed"):
            await complete("system", "user", tier=AITier.cheap, retries=0)
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
pytest tests/test_ai_router.py -v
```

- [ ] **Step 3: Write `backend/services/ai_router.py`**

```python
import asyncio
import logging
from enum import Enum
from groq import AsyncGroq
from anthropic import AsyncAnthropic
from config import settings

logger = logging.getLogger(__name__)

class AITier(str, Enum):
    cheap = "cheap"      # Groq Llama 3.3 70B: $0.59/M in, $0.79/M out
    medium = "medium"    # Claude Haiku 4.5:   $0.80/M in, $4/M out
    premium = "premium"  # Claude Sonnet 4.6:  $3/M in,   $15/M out

groq_client = AsyncGroq(api_key=settings.groq_api_key)
anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)

_FALLBACK: dict[AITier, AITier | None] = {
    AITier.cheap: AITier.medium,
    AITier.medium: AITier.premium,
    AITier.premium: None,
}

async def _call_groq(system: str, user: str, max_tokens: int) -> str:
    resp = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    return resp.choices[0].message.content

async def _call_anthropic(model: str, system: str, user: str, max_tokens: int) -> str:
    resp = await anthropic_client.messages.create(
        model=model,
        system=system,
        messages=[{"role": "user", "content": user}],
        max_tokens=max_tokens,
    )
    return resp.content[0].text

_CALLERS = {
    AITier.cheap: lambda s, u, t: _call_groq(s, u, t),
    AITier.medium: lambda s, u, t: _call_anthropic("claude-haiku-4-5-20251001", s, u, t),
    AITier.premium: lambda s, u, t: _call_anthropic("claude-sonnet-4-6", s, u, t),
}

async def complete(
    system: str,
    user: str,
    tier: AITier = AITier.cheap,
    max_tokens: int = 2000,
    retries: int = 2,
) -> str:
    current = tier
    while current is not None:
        for attempt in range(retries + 1):
            try:
                return await _CALLERS[current](system, user, max_tokens)
            except Exception as e:
                if attempt < retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                else:
                    logger.warning(f"AI router: {current} failed after {retries+1} attempts: {e}")
        current = _FALLBACK[current]
    raise RuntimeError("All AI providers failed")
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
pytest tests/test_ai_router.py -v
```
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/services/ai_router.py backend/tests/test_ai_router.py
git commit -m "feat: 3-tier AI router with retry + fallback (Groq → Haiku → Sonnet)"
```

---

## Task 4: Task Models + Parser (TDD)

**Files:**
- Create: `backend/models/task.py`
- Create: `backend/services/parser.py`
- Create: `backend/tests/test_parser.py`

- [ ] **Step 1: Write `backend/models/task.py`**

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

- [ ] **Step 2: Write failing tests**

```python
# backend/tests/test_parser.py
import pytest
import json
from unittest.mock import AsyncMock, patch
from datetime import datetime

SAMPLE_LLM_RESPONSE = json.dumps({
    "tasks": [
        {"title": "Купить молоко", "sphere": "family", "priority": 2, "is_today": True},
        {"title": "Сдать отчёт", "sphere": "work", "priority": 3, "is_today": True, "deadline": "2026-04-15T18:00:00Z"},
        {"title": "Записаться к врачу", "sphere": "health", "priority": 2, "is_today": True},
        {"title": "Прочитать книгу", "sphere": "study", "priority": 1, "is_today": False},
        {"title": "Купить билеты", "sphere": "travel", "priority": 2, "is_today": False},
    ]
})

@pytest.mark.anyio
async def test_parse_dump_returns_tasks():
    with patch("services.parser.complete", new=AsyncMock(return_value=SAMPLE_LLM_RESPONSE)):
        from services.parser import parse_dump
        result = await parse_dump("купить молоко, сдать отчёт в пятницу", {})
    assert len(result.tasks) == 5
    assert result.tasks[0].sphere.value == "family"
    assert len(result.today_top3) == 3
    assert all(t.is_today for t in result.today_top3)
    # today_top3 sorted by priority desc
    assert result.today_top3[0].priority >= result.today_top3[-1].priority
    # deadline parsed
    work_task = next(t for t in result.tasks if t.sphere.value == "work")
    assert work_task.deadline is not None

@pytest.mark.anyio
async def test_parse_dump_empty_text_raises():
    from services.parser import parse_dump
    with pytest.raises(ValueError, match="empty"):
        await parse_dump("", {})

@pytest.mark.anyio
async def test_parse_dump_invalid_json_raises():
    with patch("services.parser.complete", new=AsyncMock(return_value="not json")):
        from services.parser import parse_dump
        with pytest.raises(ValueError):
            await parse_dump("some text", {})
```

- [ ] **Step 3: Run tests — verify FAIL**

```bash
pytest tests/test_parser.py -v
```

- [ ] **Step 4: Write `backend/services/parser.py`**

```python
import json
from datetime import datetime, timezone
from services.ai_router import complete, AITier
from models.task import ParsedDump

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

async def parse_dump(text: str, user_context: dict) -> ParsedDump:
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

    raw = await complete(PARSE_SYSTEM, user_prompt, tier=AITier.cheap)

    # Strip markdown fences if model wrapped response
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1])

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}")

    if "tasks" not in data or not isinstance(data["tasks"], list):
        raise ValueError("LLM response missing 'tasks' list")

    return ParsedDump(**data)
```

- [ ] **Step 5: Run tests — verify PASS**

```bash
pytest tests/test_parser.py -v
```
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add backend/models/task.py backend/services/parser.py backend/tests/test_parser.py
git commit -m "feat: task models + dump parser (Pydantic + LLM)"
```

---

## Task 5: Dump API Endpoints (TDD)

**Files:**
- Modify: `backend/api/dump.py` (replace stub)
- Create: `backend/tests/test_dump.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_dump.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from models.task import ParsedDump, ParsedTask, Sphere, Priority

MOCK_PARSED = ParsedDump(tasks=[
    ParsedTask(title="Купить молоко", sphere=Sphere.family, priority=Priority.high, is_today=True),
    ParsedTask(title="Сдать отчёт", sphere=Sphere.work, priority=Priority.medium, is_today=True),
    ParsedTask(title="Прочитать книгу", sphere=Sphere.study, priority=Priority.low, is_today=False),
])

@pytest.mark.anyio
async def test_dump_text_returns_tasks(client):
    with patch("api.dump.parse_dump", new=AsyncMock(return_value=MOCK_PARSED)), \
         patch("api.dump.save_tasks", new=AsyncMock(return_value=("dump-id-123", ["t1","t2","t3"]))):
        resp = await client.post("/dump/text", json={"text": "купить молоко и сдать отчёт"})
    assert resp.status_code == 200
    body = resp.json()
    assert "tasks" in body
    assert "today_top3" in body
    assert len(body["tasks"]) == 3
    assert len(body["today_top3"]) <= 3

@pytest.mark.anyio
async def test_dump_text_empty_returns_422(client):
    resp = await client.post("/dump/text", json={"text": ""})
    assert resp.status_code == 422

@pytest.mark.anyio
async def test_dump_text_no_auth_returns_401():
    from httpx import AsyncClient, ASGITransport
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post("/dump/text", json={"text": "test"})
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
pytest tests/test_dump.py -v
```

- [ ] **Step 3: Replace `backend/api/dump.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Request
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from auth import get_current_user_id
from database import get_supabase
from services.stt import transcribe_audio_with_fallback
from services.parser import parse_dump
from models.task import ParsedDump

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

MAX_AUDIO_SIZE = 25 * 1024 * 1024

class TextDumpRequest(BaseModel):
    text: str
    user_context: dict = {}

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("text cannot be empty")
        return v

async def save_tasks(parsed: ParsedDump, user_id: str, raw_text: str) -> tuple[str, list[str]]:
    db = get_supabase()
    dump_result = db.table("dumps").insert({
        "user_id": user_id,
        "raw_text": raw_text,
        "status": "done",
    }).execute()
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
    task_ids = [r["id"] for r in task_result.data]
    return dump_id, task_ids

@router.post("/text")
async def dump_text(
    request: Request,
    body: TextDumpRequest,
    user_id: str = Depends(get_current_user_id),
):
    parsed = await parse_dump(body.text, body.user_context)
    dump_id, task_ids = await save_tasks(parsed, user_id, body.text)
    return {
        "dump_id": dump_id,
        "tasks": [t.model_dump() for t in parsed.tasks],
        "today_top3": [t.model_dump() for t in parsed.today_top3],
        "task_ids": task_ids,
    }

@router.post("/voice")
async def dump_voice(
    request: Request,
    file: UploadFile,
    user_id: str = Depends(get_current_user_id),
):
    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

    transcription = await transcribe_audio_with_fallback(audio_bytes, file.filename or "audio.m4a")
    parsed = await parse_dump(transcription, {})
    dump_id, task_ids = await save_tasks(parsed, user_id, transcription)
    return {
        "dump_id": dump_id,
        "transcription": transcription,
        "tasks": [t.model_dump() for t in parsed.tasks],
        "today_top3": [t.model_dump() for t in parsed.today_top3],
        "task_ids": task_ids,
    }
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
pytest tests/test_dump.py -v
```
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/api/dump.py backend/tests/test_dump.py
git commit -m "feat: dump API endpoints (text + voice) with rate limiting"
```

---

## Task 6: Tasks CRUD API

**Files:**
- Modify: `backend/api/tasks.py` (replace stub)
- Modify: `backend/api/auth.py` (replace stub)
- Create: `backend/tests/test_tasks.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_tasks.py
import pytest
from unittest.mock import patch, MagicMock

@pytest.mark.anyio
async def test_get_today_tasks_returns_list(client):
    mock_data = [
        {"id": "t1", "title": "Купить молоко", "sphere": "family", "priority": 3, "is_today": True, "is_done": False},
        {"id": "t2", "title": "Сдать отчёт", "sphere": "work", "priority": 2, "is_today": True, "is_done": False},
    ]
    with patch("api.tasks.get_supabase") as mock_db:
        mock_db.return_value.table.return_value.select.return_value\
            .eq.return_value.eq.return_value.eq.return_value\
            .order.return_value.limit.return_value.execute.return_value\
            .data = mock_data
        resp = await client.get("/tasks/today")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

@pytest.mark.anyio
async def test_patch_task_updates_fields(client):
    mock_data = [{"id": "t1", "title": "Обновлено", "is_done": True}]
    with patch("api.tasks.get_supabase") as mock_db:
        chain = mock_db.return_value.table.return_value
        chain.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = mock_data
        resp = await client.patch("/tasks/t1", json={"is_done": True})
    assert resp.status_code == 200
```

- [ ] **Step 2: Run — verify FAIL**

```bash
pytest tests/test_tasks.py -v
```

- [ ] **Step 3: Replace `backend/api/tasks.py`**

```python
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user_id
from database import get_supabase

router = APIRouter()

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    sphere: Optional[str] = None
    priority: Optional[int] = None
    deadline: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    is_done: Optional[bool] = None
    is_today: Optional[bool] = None

@router.get("/today")
async def get_today_tasks(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = (
        db.table("tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_today", True)
        .eq("is_done", False)
        .order("priority", desc=True)
        .limit(3)
        .execute()
    )
    return result.data

@router.get("/")
async def get_all_tasks(
    sphere: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    db = get_supabase()
    q = db.table("tasks").select("*").eq("user_id", user_id).eq("is_done", False)
    if sphere:
        q = q.eq("sphere", sphere)
    result = q.order("priority", desc=True).range(offset, offset + limit - 1).execute()
    return result.data

@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "deadline" in updates and updates["deadline"] is not None:
        updates["deadline"] = updates["deadline"].isoformat()
    if "reminder_at" in updates and updates["reminder_at"] is not None:
        updates["reminder_at"] = updates["reminder_at"].isoformat()

    db = get_supabase()
    result = (
        db.table("tasks")
        .update(updates)
        .eq("id", task_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.data[0]

@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    db.table("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()
```

- [ ] **Step 4: Replace `backend/api/auth.py`**

```python
from fastapi import APIRouter, Depends
from auth import get_current_user_id
from database import get_supabase

router = APIRouter()

@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = db.table("user_profiles").select("*").eq("id", user_id).execute()
    profile = result.data[0] if result.data else None
    return {"id": user_id, "profile": profile}

@router.post("/profile")
async def upsert_profile(body: dict, user_id: str = Depends(get_current_user_id)):
    body["id"] = user_id
    db = get_supabase()
    result = db.table("user_profiles").upsert(body).execute()
    return result.data[0]
```

- [ ] **Step 5: Run all tests — verify PASS**

```bash
pytest tests/ -v
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/api/tasks.py backend/api/auth.py backend/tests/test_tasks.py
git commit -m "feat: tasks CRUD + auth/profile API endpoints"
```

---

## Task 7: pgvector Memory Service

**Files:**
- Create: `backend/services/memory_store.py`
- Modify: `backend/api/memory.py` (replace stub)

- [ ] **Step 1: Write `backend/services/memory_store.py`**

```python
from openai import AsyncOpenAI
from database import get_supabase
from config import settings

openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

async def _embed(text: str) -> list[float]:
    resp = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=1536,
    )
    return resp.data[0].embedding

async def save_memory(user_id: str, content: str, metadata: dict = {}) -> str:
    embedding = await _embed(content)
    db = get_supabase()
    result = db.table("memory_embeddings").insert({
        "user_id": user_id,
        "content": content,
        "embedding": embedding,
        "metadata": metadata,
    }).execute()
    return result.data[0]["id"]

async def search_relevant_memory(
    user_id: str,
    query: str,
    limit: int = 5,
    threshold: float = 0.7,
) -> list[str]:
    query_embedding = await _embed(query)
    db = get_supabase()
    result = db.rpc("match_memories", {
        "user_id_input": user_id,
        "query_embedding": query_embedding,
        "match_count": limit,
        "match_threshold": threshold,
    }).execute()
    return [row["content"] for row in result.data]
```

- [ ] **Step 2: Replace `backend/api/memory.py`**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import get_current_user_id
from database import get_supabase
from services.memory_store import search_relevant_memory

router = APIRouter()

class MemorySearchRequest(BaseModel):
    query: str
    limit: int = 5

@router.post("/search")
async def search_memory(body: MemorySearchRequest, user_id: str = Depends(get_current_user_id)):
    results = await search_relevant_memory(user_id, body.query, body.limit)
    return {"results": results}

@router.get("/profile")
async def get_memory_profile(user_id: str = Depends(get_current_user_id)):
    db = get_supabase()
    result = (
        db.table("memory_embeddings")
        .select("id, content, metadata, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return result.data
```

- [ ] **Step 3: Run full test suite**

```bash
pytest tests/ -v
```
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/services/memory_store.py backend/api/memory.py
git commit -m "feat: pgvector semantic memory — halfvec(1536) + HNSW search"
```

---

## Task 8: Mobile App Scaffold

**Files:**
- Create: `mobile/` directory (Expo project)
- Create: `mobile/store/useAppStore.ts`
- Create: `mobile/services/api.ts`
- Create: `mobile/constants/spheres.ts`

- [ ] **Step 1: Init Expo project**

```bash
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-router expo-audio expo-notifications expo-build-properties expo-dev-client
npx expo install react-native-mmkv zustand @supabase/supabase-js axios
npx expo install react-native-purchases react-native-purchases-ui
```

- [ ] **Step 3: Configure `mobile/app.json`**

```json
{
  "expo": {
    "name": "Second Brain",
    "slug": "second-brain",
    "scheme": "secondbrain",
    "version": "1.0.0",
    "newArchEnabled": true,
    "web": { "bundler": "metro" },
    "plugins": [
      "expo-router",
      [
        "expo-audio",
        { "microphonePermission": "$(PRODUCT_NAME) использует микрофон для голосового ввода задач" }
      ],
      [
        "expo-notifications",
        { "icon": "./assets/notification-icon.png", "color": "#ffffff" }
      ]
    ]
  }
}
```

- [ ] **Step 4: Write `mobile/constants/spheres.ts`**

```typescript
export type Sphere = 'work' | 'family' | 'study' | 'health' | 'travel';

export interface SphereInfo {
  id: Sphere;
  label: string;
  icon: string;
  color: string;
}

export const SPHERES: SphereInfo[] = [
  { id: 'work',   label: 'Работа',  icon: '💼', color: '#4F8EF7' },
  { id: 'family', label: 'Семья',   icon: '👨‍👩‍👧', color: '#F7934C' },
  { id: 'study',  label: 'Учёба',   icon: '📚', color: '#9B59B6' },
  { id: 'health', label: 'Здоровье',icon: '💪', color: '#2ECC71' },
  { id: 'travel', label: 'Поездки', icon: '✈️', color: '#E74C3C' },
];

export const SPHERE_MAP = Object.fromEntries(SPHERES.map(s => [s.id, s])) as Record<Sphere, SphereInfo>;
```

- [ ] **Step 5: Write `mobile/store/useAppStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { Sphere } from '../constants/spheres';

export interface Task {
  id: string;
  title: string;
  sphere: Sphere;
  priority: 1 | 2 | 3;
  is_done: boolean;
  is_today: boolean;
  deadline?: string | null;
  reminder_at?: string | null;
  notes?: string | null;
}

export interface UserProfile {
  id: string;
  name?: string;
  language?: string;
  role?: string;
  living_with?: string;
  peak_hours?: string;
}

interface AppState {
  user: UserProfile | null;
  todayTasks: Task[];
  allTasks: Task[];
  isOnboarded: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setTodayTasks: (tasks: Task[]) => void;
  setAllTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setOnboarded: (v: boolean) => void;
  setLoading: (v: boolean) => void;
}

const mmkv = new MMKV({ id: 'app-store' });
const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.delete(key),
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      todayTasks: [],
      allTasks: [],
      isOnboarded: false,
      isLoading: false,
      setUser: (user) => set({ user }),
      setTodayTasks: (todayTasks) => set({ todayTasks }),
      setAllTasks: (allTasks) => set({ allTasks }),
      updateTask: (id, updates) =>
        set((s) => ({
          todayTasks: s.todayTasks.map((t) => t.id === id ? { ...t, ...updates } : t),
          allTasks: s.allTasks.map((t) => t.id === id ? { ...t, ...updates } : t),
        })),
      deleteTask: (id) =>
        set((s) => ({
          todayTasks: s.todayTasks.filter((t) => t.id !== id),
          allTasks: s.allTasks.filter((t) => t.id !== id),
        })),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);
```

- [ ] **Step 6: Write `mobile/services/api.ts`**

```typescript
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { Task } from '../store/useAppStore';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const api = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL });

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export interface DumpTextResponse {
  dump_id: string;
  tasks: Task[];
  today_top3: Task[];
  task_ids: string[];
}

export interface DumpVoiceResponse extends DumpTextResponse {
  transcription: string;
}

export async function dumpText(text: string, userContext: object = {}): Promise<DumpTextResponse> {
  const { data } = await api.post('/dump/text', { text, user_context: userContext });
  return data;
}

export async function dumpVoice(uri: string): Promise<DumpVoiceResponse> {
  const formData = new FormData();
  formData.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' } as any);
  const { data } = await api.post('/dump/voice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getTodayTasks(): Promise<Task[]> {
  const { data } = await api.get('/tasks/today');
  return data;
}

export async function getAllTasks(sphere?: string): Promise<Task[]> {
  const { data } = await api.get('/tasks/', { params: sphere ? { sphere } : {} });
  return data;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const { data } = await api.patch(`/tasks/${id}`, updates);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
```

- [ ] **Step 7: Write `mobile/.env.example`**

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_RC_IOS_KEY=appl_...
EXPO_PUBLIC_RC_ANDROID_KEY=goog_...
```

- [ ] **Step 8: Commit**

```bash
git add mobile/
git commit -m "feat: Expo scaffold — Zustand+MMKV store + typed API service"
```

---

## Task 9: Audio Service + UI Components

**Files:**
- Create: `mobile/services/audio.ts`
- Create: `mobile/components/TaskCard.tsx`
- Create: `mobile/components/VoiceWave.tsx`
- Create: `mobile/components/SphereTab.tsx`
- Create: `mobile/components/DumpButton.tsx`

- [ ] **Step 1: Write `mobile/services/audio.ts`**

```typescript
// ⚠️ Uses expo-audio (SDK 53+), NOT expo-av which is deprecated
import { useState } from 'react';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startRecording() {
    setError(null);
    setAudioUri(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError('Нет разрешения на микрофон');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
  }

  async function stopRecording(): Promise<string | null> {
    await recorder.stop();
    const uri = recorder.uri ?? null;
    setAudioUri(uri);
    setIsRecording(false);
    return uri;
  }

  return { isRecording, audioUri, error, startRecording, stopRecording };
}
```

- [ ] **Step 2: Write `mobile/components/TaskCard.tsx`**

```typescript
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Task, useAppStore } from '../store/useAppStore';
import { SPHERE_MAP } from '../constants/spheres';
import { updateTask } from '../services/api';

interface Props {
  task: Task;
  onPress?: () => void;
}

const PRIORITY_COLOR: Record<number, string> = { 1: '#6b7280', 2: '#f59e0b', 3: '#ef4444' };

export default function TaskCard({ task, onPress }: Props) {
  const { updateTask: updateStore } = useAppStore();
  const sphere = SPHERE_MAP[task.sphere];

  async function handleDone() {
    await updateTask(task.id, { is_done: true });
    updateStore(task.id, { is_done: true });
  }

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.sphereBar, { backgroundColor: sphere?.color ?? '#999' }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{task.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.sphere}>{sphere?.icon} {sphere?.label}</Text>
          {task.deadline && <Text style={styles.deadline}>📅 {new Date(task.deadline).toLocaleDateString('ru')}</Text>}
        </View>
      </View>
      <Pressable onPress={handleDone} style={styles.doneBtn}>
        <Text style={{ color: PRIORITY_COLOR[task.priority] }}>✓</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  sphereBar: { width: 4 },
  content: { flex: 1, padding: 12 },
  title: { color: '#fff', fontSize: 15, fontWeight: '500' },
  meta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  sphere: { color: '#888', fontSize: 12 },
  deadline: { color: '#888', fontSize: 12 },
  doneBtn: { justifyContent: 'center', paddingHorizontal: 16 },
});
```

- [ ] **Step 3: Write `mobile/components/VoiceWave.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface Props {
  isRecording: boolean;
}

export default function VoiceWave({ isRecording }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scale.stopAnimation();
      scale.setValue(1);
    }
  }, [isRecording]);

  return (
    <View style={styles.container}>
      {[1.6, 1.3, 1].map((s, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            { transform: [{ scale: Animated.multiply(scale, s) }], opacity: isRecording ? 0.2 / s : 0 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#4F8EF7' },
});
```

- [ ] **Step 4: Write `mobile/components/SphereTab.tsx`**

```typescript
import { Pressable, Text, StyleSheet } from 'react-native';
import { Sphere, SPHERE_MAP } from '../constants/spheres';

interface Props {
  sphere: Sphere | 'all';
  count?: number;
  isActive: boolean;
  onPress: () => void;
}

export default function SphereTab({ sphere, count, isActive, onPress }: Props) {
  const info = sphere === 'all' ? { icon: '📋', label: 'Все', color: '#6b7280' } : SPHERE_MAP[sphere];
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, isActive && { borderBottomColor: info.color, borderBottomWidth: 2 }]}
    >
      <Text style={styles.icon}>{info.icon}</Text>
      <Text style={[styles.label, isActive && { color: '#fff' }]}>{info.label}</Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  icon: { fontSize: 16 },
  label: { color: '#888', fontSize: 12, marginTop: 2 },
  count: { color: '#4F8EF7', fontSize: 11, marginTop: 1 },
});
```

- [ ] **Step 5: Write `mobile/components/DumpButton.tsx`**

```typescript
import { Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function DumpButton() {
  const router = useRouter();
  return (
    <Pressable style={styles.fab} onPress={() => router.push('/(app)/dump')}>
      <Text style={styles.icon}>🎤</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#4F8EF7', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4F8EF7', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  icon: { fontSize: 24 },
});
```

- [ ] **Step 6: Commit**

```bash
git add mobile/services/audio.ts mobile/components/
git commit -m "feat: audio hook (expo-audio) + TaskCard/VoiceWave/SphereTab/DumpButton"
```

---

## Task 10: Root Layout + Auth Guard

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(onboarding)/_layout.tsx`
- Create: `mobile/app/(app)/_layout.tsx`
- Create: `mobile/services/purchases.ts`
- Create: `mobile/services/notifications.ts`

- [ ] **Step 1: Write `mobile/services/purchases.ts`**

```typescript
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export function initRevenueCat(userId?: string) {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
    : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;
  Purchases.configure({ apiKey });
  if (userId) Purchases.logIn(userId);
}

export async function isPremium(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return typeof info.entitlements.active['premium'] !== 'undefined';
}

export async function buyPremium(): Promise<boolean> {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.monthly;
  if (!pkg) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return typeof customerInfo.entitlements.active['premium'] !== 'undefined';
  } catch (e: any) {
    if (e.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  return typeof info.entitlements.active['premium'] !== 'undefined';
}
```

- [ ] **Step 2: Write `mobile/services/notifications.ts`**

```typescript
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Task } from '../store/useAppStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function requestPushPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function scheduleReminder(task: Task): Promise<string | null> {
  if (!task.reminder_at) return null;
  const date = new Date(task.reminder_at);
  if (date <= new Date()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: task.title,
      body: 'Напоминание о задаче',
      data: { taskId: task.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

export async function scheduleEveningReminder(name: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: `${name}, как прошёл день? 🌙`, body: 'Пора разгрузиться перед сном.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 },
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: `Доброе утро, ${name} ☀️`, body: 'Что у нас на сегодня?' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 },
  });
}
```

- [ ] **Step 3: Write `mobile/app/_layout.tsx`**

```typescript
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { supabase } from '../services/api';
import { initRevenueCat } from '../services/purchases';
import { useAppStore } from '../store/useAppStore';
import { getTodayTasks, getAllTasks } from '../services/api';

export default function RootLayout() {
  const { isOnboarded, user, setUser, setTodayTasks, setAllTasks } = useAppStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initRevenueCat(user?.id);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser({ id: session.user.id, ...session.user.user_metadata });
        const [today, all] = await Promise.all([getTodayTasks(), getAllTasks()]);
        setTodayTasks(today);
        setAllTasks(all);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setTodayTasks([]);
        setAllTasks([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const inOnboarding = segments[0] === '(onboarding)';
    if (!user && !inOnboarding) {
      router.replace('/(onboarding)/welcome');
    } else if (user && !isOnboarded && !inOnboarding) {
      router.replace('/(onboarding)/first-dump');
    } else if (user && isOnboarded && inOnboarding) {
      router.replace('/(app)/');
    }
  }, [user, isOnboarded, segments]);

  // Handle notification taps
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const taskId = response.notification.request.content.data?.taskId;
      if (taskId) router.push(`/(app)/task/${taskId}`);
    });
    return () => sub.remove();
  }, []);

  return <Slot />;
}
```

- [ ] **Step 4: Write `mobile/app/(onboarding)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router';
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Write `mobile/app/(app)/_layout.tsx`**

```typescript
import { Tabs } from 'expo-router';
export default function AppLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: '#0A0A0A', borderTopColor: '#1A1A1A' },
      tabBarActiveTintColor: '#4F8EF7',
      tabBarInactiveTintColor: '#555',
      headerShown: false,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Сегодня', tabBarIcon: () => '🏠' }} />
      <Tabs.Screen name="all" options={{ title: 'Все', tabBarIcon: () => '📋' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: () => '👤' }} />
      <Tabs.Screen name="dump" options={{ href: null }} />
      <Tabs.Screen name="result" options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/app/ mobile/services/purchases.ts mobile/services/notifications.ts
git commit -m "feat: root layout + auth guard + tab/stack navigators"
```

---

## Task 11: Onboarding Screens

**Files:**
- Create: `mobile/app/(onboarding)/welcome.tsx`
- Create: `mobile/app/(onboarding)/setup.tsx`
- Create: `mobile/app/(onboarding)/first-dump.tsx`

- [ ] **Step 1: Write `mobile/app/(onboarding)/welcome.tsx`**

```typescript
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/api';

export default function Welcome() {
  const router = useRouter();

  async function handleSignIn() {
    // Supabase magic link or OAuth — simplest path for MVP
    const email = 'demo@secondbrain.app'; // replace with actual input in v2
    await supabase.auth.signInWithOtp({ email });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🧠</Text>
      <Text style={styles.title}>Привет, я твой{'\n'}Второй Мозг</Text>
      <Text style={styles.subtitle}>
        Скажи всё что у тебя в голове — я структурирую и напомню.
      </Text>
      <Pressable style={styles.primary} onPress={() => router.push('/(onboarding)/setup')}>
        <Text style={styles.primaryText}>Начать →</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={handleSignIn}>
        <Text style={styles.secondaryText}>Уже есть аккаунт</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 40 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 16, marginBottom: 48, lineHeight: 24 },
  primary: { backgroundColor: '#4F8EF7', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48, width: '100%', alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  secondary: { marginTop: 16 },
  secondaryText: { color: '#555', fontSize: 15 },
});
```

- [ ] **Step 2: Write `mobile/app/(onboarding)/setup.tsx`**

```typescript
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import axios from 'axios';

type Role = 'mom' | 'freelancer' | 'student' | 'entrepreneur' | 'other';
type PeakHours = 'morning' | 'afternoon' | 'evening';

const ROLES: { id: Role; label: string }[] = [
  { id: 'mom', label: '👩 Мама' },
  { id: 'freelancer', label: '💻 Фрилансер' },
  { id: 'student', label: '📚 Студент' },
  { id: 'entrepreneur', label: '🚀 Предприниматель' },
  { id: 'other', label: '👤 Другое' },
];

const PEAK_HOURS: { id: PeakHours; label: string }[] = [
  { id: 'morning', label: '☀️ Утро' },
  { id: 'afternoon', label: '🌤 День' },
  { id: 'evening', label: '🌙 Вечер' },
];

export default function Setup() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHours | null>(null);

  async function handleNext() {
    if (step < 2) { setStep(step + 1); return; }
    // Save profile via API then go to first-dump
    try {
      const { default: api } = await import('../../services/api');
      await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/auth/profile`, {
        name, role, peak_hours: peakHours,
      });
      setUser((prev: any) => ({ ...prev, name, role, peak_hours: peakHours }));
    } catch { /* continue even if profile save fails */ }
    router.push('/(onboarding)/first-dump');
  }

  return (
    <View style={styles.container}>
      {step === 0 && (
        <>
          <Text style={styles.title}>Как тебя зовут?</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Имя"
            placeholderTextColor="#555"
            autoFocus
          />
        </>
      )}
      {step === 1 && (
        <>
          <Text style={styles.title}>Кто ты?</Text>
          {ROLES.map(r => (
            <Pressable key={r.id} style={[styles.chip, role === r.id && styles.chipActive]} onPress={() => setRole(r.id)}>
              <Text style={styles.chipText}>{r.label}</Text>
            </Pressable>
          ))}
        </>
      )}
      {step === 2 && (
        <>
          <Text style={styles.title}>Когда ты активнее?</Text>
          {PEAK_HOURS.map(p => (
            <Pressable key={p.id} style={[styles.chip, peakHours === p.id && styles.chipActive]} onPress={() => setPeakHours(p.id)}>
              <Text style={styles.chipText}>{p.label}</Text>
            </Pressable>
          ))}
        </>
      )}
      <Pressable style={styles.next} onPress={handleNext}>
        <Text style={styles.nextText}>{step < 2 ? 'Далее →' : 'Поехали! 🚀'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 32, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 32 },
  input: { backgroundColor: '#1A1A1A', color: '#fff', borderRadius: 12, padding: 16, fontSize: 18 },
  chip: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  chipActive: { borderColor: '#4F8EF7' },
  chipText: { color: '#fff', fontSize: 16 },
  next: { backgroundColor: '#4F8EF7', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 32 },
  nextText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
```

- [ ] **Step 3: Write `mobile/app/(onboarding)/first-dump.tsx`**

```typescript
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useVoiceRecorder } from '../../services/audio';
import { dumpVoice } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { scheduleEveningReminder } from '../../services/notifications';
import VoiceWave from '../../components/VoiceWave';
import { Task } from '../../store/useAppStore';

export default function FirstDump() {
  const router = useRouter();
  const { setTodayTasks, setAllTasks, setOnboarded, user } = useAppStore();
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const [step, setStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [top3, setTop3] = useState<Task[]>([]);
  const [shownCount, setShownCount] = useState(0);

  async function handleStop() {
    const uri = await stopRecording();
    if (!uri) return;
    setStep(2); // processing
    setProcessing(true);
    try {
      const result = await dumpVoice(uri);
      setTodayTasks(result.today_top3);
      setAllTasks(result.tasks);
      setTop3(result.today_top3);
      setStep(3);
      setShownCount(1);
    } catch {
      setStep(0); // retry
    } finally {
      setProcessing(false);
    }
  }

  async function handleFinish() {
    if (user?.name) await scheduleEveningReminder(user.name);
    setOnboarded(true);
    router.replace('/(app)/');
  }

  if (step === 0) return (
    <View style={styles.container}>
      <Text style={styles.title}>Расскажи всё что{'\n'}у тебя на уме</Text>
      <Text style={styles.sub}>Нажми на микрофон и говори свободно</Text>
      <Pressable style={styles.mic} onPress={() => { startRecording(); setStep(1); }}>
        <Text style={{ fontSize: 40 }}>🎤</Text>
      </Pressable>
    </View>
  );

  if (step === 1) return (
    <View style={styles.container}>
      <Text style={styles.title}>Слушаю...</Text>
      <VoiceWave isRecording={isRecording} />
      <Pressable style={[styles.mic, { backgroundColor: '#ef4444' }]} onPress={handleStop}>
        <Text style={{ fontSize: 32 }}>⏹</Text>
      </Pressable>
    </View>
  );

  if (step === 2) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4F8EF7" />
      <Text style={[styles.sub, { marginTop: 24 }]}>AI разбирает твои мысли...</Text>
    </View>
  );

  // Steps 3+ — reveal top3 tasks one by one
  if (step >= 3) {
    const currentTask = top3[shownCount - 1];
    const allShown = shownCount >= top3.length;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Готово! 🎉</Text>
        {top3.slice(0, shownCount).map((t, i) => (
          <View key={t.id} style={styles.taskPreview}>
            <Text style={styles.taskNum}>{i + 1}.</Text>
            <Text style={styles.taskTitle}>{t.title}</Text>
          </View>
        ))}
        {allShown ? (
          <Pressable style={styles.cta} onPress={handleFinish}>
            <Text style={styles.ctaText}>Поехали! 🚀</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.next} onPress={() => setShownCount(c => c + 1)}>
            <Text style={styles.nextText}>Далее →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 16 },
  sub: { color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 32 },
  mic: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4F8EF7', alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  taskPreview: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 12, alignSelf: 'flex-start' },
  taskNum: { color: '#4F8EF7', fontSize: 18, fontWeight: '700' },
  taskTitle: { color: '#fff', fontSize: 18, flex: 1 },
  cta: { backgroundColor: '#4F8EF7', borderRadius: 16, padding: 16, paddingHorizontal: 48, marginTop: 32 },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  next: { borderWidth: 1, borderColor: '#4F8EF7', borderRadius: 16, padding: 16, paddingHorizontal: 48, marginTop: 32 },
  nextText: { color: '#4F8EF7', fontSize: 16 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/(onboarding)/
git commit -m "feat: onboarding flow — welcome + setup + first dump WOW moment"
```

---

## Task 12: Core App Screens

**Files:**
- Create: `mobile/app/(app)/index.tsx`
- Create: `mobile/app/(app)/dump.tsx`
- Create: `mobile/app/(app)/result.tsx`
- Create: `mobile/app/(app)/all.tsx`
- Create: `mobile/app/(app)/task/[id].tsx`
- Create: `mobile/app/(app)/profile.tsx`

- [ ] **Step 1: Write `mobile/app/(app)/index.tsx` (Home)**

```typescript
import { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { getTodayTasks } from '../../services/api';
import TaskCard from '../../components/TaskCard';
import DumpButton from '../../components/DumpButton';
import { useRouter } from 'expo-router';

export default function Home() {
  const { todayTasks, user, setTodayTasks, isLoading, setLoading } = useAppStore();
  const router = useRouter();

  async function refresh() {
    setLoading(true);
    const tasks = await getTodayTasks();
    setTodayTasks(tasks);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  const greeting = user?.name ? `Привет, ${user.name} 👋` : 'Привет! 👋';
  const today = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      <Text style={styles.section}>На сегодня</Text>

      {todayTasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Нет задач на сегодня</Text>
          <Text style={styles.emptyHint}>Нажми 🎤 чтобы добавить</Text>
        </View>
      ) : (
        <FlatList
          data={todayTasks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => router.push(`/(app)/task/${item.id}`)} />
          )}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        />
      )}
      <DumpButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 16 },
  header: { paddingTop: 48, marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#fff' },
  date: { color: '#888', fontSize: 14, marginTop: 4 },
  section: { color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: '#555', fontSize: 16 },
  emptyHint: { color: '#333', fontSize: 14 },
});
```

- [ ] **Step 2: Write `mobile/app/(app)/dump.tsx`**

```typescript
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useVoiceRecorder } from '../../services/audio';
import { dumpText, dumpVoice } from '../../services/api';
import VoiceWave from '../../components/VoiceWave';

export default function Dump() {
  const router = useRouter();
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVoiceStop() {
    const uri = await stopRecording();
    if (!uri) return;
    setLoading(true);
    try {
      const result = await dumpVoice(uri);
      router.push({ pathname: '/(app)/result', params: { data: JSON.stringify(result) } });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message ?? 'Не удалось обработать запись');
    } finally { setLoading(false); }
  }

  async function handleTextSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await dumpText(text.trim());
      router.push({ pathname: '/(app)/result', params: { data: JSON.stringify(result) } });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message ?? 'Не удалось обработать текст');
    } finally { setLoading(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        <Pressable style={[styles.tab, mode === 'voice' && styles.tabActive]} onPress={() => setMode('voice')}>
          <Text style={styles.tabText}>🎤 Голос</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === 'text' && styles.tabActive]} onPress={() => setMode('text')}>
          <Text style={styles.tabText}>⌨️ Текст</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F8EF7" />
          <Text style={styles.loadingText}>AI обрабатывает...</Text>
        </View>
      ) : mode === 'voice' ? (
        <View style={styles.center}>
          <VoiceWave isRecording={isRecording} />
          <Pressable
            style={[styles.mic, isRecording && { backgroundColor: '#ef4444' }]}
            onPress={isRecording ? handleVoiceStop : startRecording}
          >
            <Text style={{ fontSize: 36 }}>{isRecording ? '⏹' : '🎤'}</Text>
          </Pressable>
          <Text style={styles.hint}>{isRecording ? 'Нажми чтобы остановить' : 'Нажми чтобы начать'}</Text>
        </View>
      ) : (
        <View style={styles.textMode}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Напиши всё что у тебя на уме..."
            placeholderTextColor="#555"
            multiline
            autoFocus
          />
          <Pressable style={styles.submit} onPress={handleTextSubmit}>
            <Text style={styles.submitText}>Отправить →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 16, paddingTop: 48 },
  toggle: { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 4, marginBottom: 32 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#4F8EF7' },
  tabText: { color: '#fff', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  mic: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4F8EF7', alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#888', fontSize: 15 },
  loadingText: { color: '#888', marginTop: 16 },
  textMode: { flex: 1, gap: 16 },
  textInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#fff', borderRadius: 16, padding: 16, fontSize: 16, textAlignVertical: 'top' },
  submit: { backgroundColor: '#4F8EF7', borderRadius: 16, padding: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
```

- [ ] **Step 3: Write `mobile/app/(app)/result.tsx`**

```typescript
import { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Task } from '../../store/useAppStore';
import { SPHERES, Sphere } from '../../constants/spheres';
import TaskCard from '../../components/TaskCard';
import SphereTab from '../../components/SphereTab';

export default function Result() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const parsed = data ? JSON.parse(data) : { tasks: [], today_top3: [], transcription: null };
  const tasks: Task[] = parsed.tasks ?? [];

  const [selectedSphere, setSelectedSphere] = useState<Sphere | 'all'>('all');

  const spheresPresent = Array.from(new Set(tasks.map(t => t.sphere))) as Sphere[];
  const displayed = selectedSphere === 'all' ? tasks : tasks.filter(t => t.sphere === selectedSphere);

  return (
    <View style={styles.container}>
      {parsed.transcription && (
        <View style={styles.transcript}>
          <Text style={styles.transcriptLabel}>Транскрипция</Text>
          <Text style={styles.transcriptText} numberOfLines={3}>{parsed.transcription}</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        <SphereTab sphere="all" count={tasks.length} isActive={selectedSphere === 'all'} onPress={() => setSelectedSphere('all')} />
        {spheresPresent.map(s => (
          <SphereTab key={s} sphere={s} count={tasks.filter(t => t.sphere === s).length} isActive={selectedSphere === s} onPress={() => setSelectedSphere(s)} />
        ))}
      </ScrollView>

      <FlatList
        data={displayed}
        keyExtractor={t => t.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        style={styles.list}
      />

      <Pressable style={styles.done} onPress={() => router.replace('/(app)/')}>
        <Text style={styles.doneText}>Готово ✓</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 16, paddingTop: 48 },
  transcript: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 16 },
  transcriptLabel: { color: '#555', fontSize: 11, marginBottom: 4 },
  transcriptText: { color: '#888', fontSize: 13 },
  tabs: { marginBottom: 16, flexGrow: 0 },
  list: { flex: 1 },
  done: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8 },
  doneText: { color: '#4F8EF7', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 4: Write `mobile/app/(app)/all.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { View, FlatList, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import { getAllTasks } from '../../services/api';
import { SPHERES, Sphere } from '../../constants/spheres';
import TaskCard from '../../components/TaskCard';
import SphereTab from '../../components/SphereTab';

export default function All() {
  const { allTasks, setAllTasks, isLoading, setLoading } = useAppStore();
  const router = useRouter();
  const [sphere, setSphere] = useState<Sphere | 'all'>('all');

  async function refresh() {
    setLoading(true);
    const tasks = await getAllTasks(sphere === 'all' ? undefined : sphere);
    setAllTasks(tasks);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [sphere]);

  const displayed = sphere === 'all' ? allTasks : allTasks.filter(t => t.sphere === sphere);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        <SphereTab sphere="all" count={allTasks.length} isActive={sphere === 'all'} onPress={() => setSphere('all')} />
        {SPHERES.map(s => (
          <SphereTab key={s.id} sphere={s.id} count={allTasks.filter(t => t.sphere === s.id).length} isActive={sphere === s.id} onPress={() => setSphere(s.id)} />
        ))}
      </ScrollView>
      <FlatList
        data={displayed}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TaskCard task={item} onPress={() => router.push(`/(app)/task/${item.id}`)} />
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 16, paddingTop: 48 },
  tabs: { marginBottom: 16, flexGrow: 0 },
});
```

- [ ] **Step 5: Write `mobile/app/(app)/task/[id].tsx`**

```typescript
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore, Task } from '../../../store/useAppStore';
import { updateTask, deleteTask } from '../../../services/api';
import { scheduleReminder } from '../../../services/notifications';
import { SPHERE_MAP } from '../../../constants/spheres';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allTasks, todayTasks, updateTask: updateStore, deleteTask: deleteStore } = useAppStore();
  const router = useRouter();
  const task = [...allTasks, ...todayTasks].find(t => t.id === id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task?.title ?? '');

  if (!task) return null;

  async function handleDone() {
    await updateTask(id!, { is_done: true });
    updateStore(id!, { is_done: true });
    router.back();
  }

  async function handleSaveTitle() {
    await updateTask(id!, { title });
    updateStore(id!, { title });
    setEditing(false);
  }

  async function handleDelete() {
    Alert.alert('Удалить задачу?', task.title, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        await deleteTask(id!);
        deleteStore(id!);
        router.back();
      }},
    ]);
  }

  const sphere = SPHERE_MAP[task.sphere];

  return (
    <View style={styles.container}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Назад</Text>
      </Pressable>

      <View style={[styles.spherePill, { backgroundColor: sphere.color + '33' }]}>
        <Text style={{ color: sphere.color }}>{sphere.icon} {sphere.label}</Text>
      </View>

      {editing ? (
        <>
          <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} autoFocus />
          <Pressable onPress={handleSaveTitle}><Text style={styles.save}>Сохранить</Text></Pressable>
        </>
      ) : (
        <Pressable onPress={() => setEditing(true)}>
          <Text style={styles.title}>{task.title}</Text>
        </Pressable>
      )}

      {task.notes && <Text style={styles.notes}>{task.notes}</Text>}
      {task.deadline && <Text style={styles.meta}>📅 {new Date(task.deadline).toLocaleString('ru')}</Text>}
      {task.reminder_at && <Text style={styles.meta}>🔔 {new Date(task.reminder_at).toLocaleString('ru')}</Text>}

      <View style={styles.actions}>
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>✓ Выполнено</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑 Удалить</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 24, paddingTop: 64 },
  back: { marginBottom: 24 },
  backText: { color: '#4F8EF7', fontSize: 16 },
  spherePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  titleInput: { color: '#fff', fontSize: 24, fontWeight: '700', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 8 },
  save: { color: '#4F8EF7', fontSize: 16, marginBottom: 12 },
  notes: { color: '#888', fontSize: 15, marginBottom: 8 },
  meta: { color: '#666', fontSize: 14, marginBottom: 4 },
  actions: { position: 'absolute', bottom: 40, left: 24, right: 24, gap: 12 },
  doneBtn: { backgroundColor: '#2ECC71', borderRadius: 16, padding: 16, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, alignItems: 'center' },
  deleteBtnText: { color: '#ef4444', fontSize: 16 },
});
```

- [ ] **Step 6: Write `mobile/app/(app)/profile.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../services/api';
import { isPremium, buyPremium, restorePurchases, initRevenueCat } from '../../services/purchases';
import { requestPushPermission, scheduleEveningReminder } from '../../services/notifications';
import axios from 'axios';

export default function Profile() {
  const { user, allTasks, todayTasks, setUser, setTodayTasks, setAllTasks, setOnboarded } = useAppStore();
  const [hasPremium, setHasPremium] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);

  useEffect(() => {
    initRevenueCat(user?.id);
    isPremium().then(setHasPremium);
    loadMemories();
  }, []);

  async function loadMemories() {
    try {
      const { data } = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/memory/profile`);
      setMemories(data.slice(0, 5));
    } catch { }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null); setTodayTasks([]); setAllTasks([]); setOnboarded(false);
  }

  async function handleBuyPremium() {
    const ok = await buyPremium();
    if (ok) setHasPremium(true);
  }

  const doneCount = allTasks.filter(t => t.is_done).length;
  const totalCount = allTasks.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <Text style={styles.name}>{user?.name ?? 'Пользователь'}</Text>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalCount}</Text>
          <Text style={styles.statLabel}>задач</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{doneCount}</Text>
          <Text style={styles.statLabel}>выполнено</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0}%</Text>
          <Text style={styles.statLabel}>прогресс</Text>
        </View>
      </View>

      {!hasPremium && (
        <Pressable style={styles.premium} onPress={handleBuyPremium}>
          <Text style={styles.premiumText}>⭐ Получить Премиум — $4.99/мес</Text>
        </Pressable>
      )}
      {hasPremium && <Text style={styles.premiumBadge}>⭐ Premium</Text>}

      <Pressable style={styles.row} onPress={async () => {
        const ok = await requestPushPermission();
        if (ok && user?.name) await scheduleEveningReminder(user.name);
        Alert.alert(ok ? 'Уведомления включены ✓' : 'Нет разрешения');
      }}>
        <Text style={styles.rowText}>🔔 Ежедневные напоминания</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => restorePurchases().then(ok => ok && setHasPremium(true))}>
        <Text style={styles.rowText}>↩️ Восстановить покупки</Text>
      </Pressable>

      <Pressable style={[styles.row, styles.signOut]} onPress={handleSignOut}>
        <Text style={[styles.rowText, { color: '#ef4444' }]}>Выйти</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 24, paddingTop: 64, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4F8EF7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  stats: { flexDirection: 'row', gap: 32, marginBottom: 32 },
  statItem: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12 },
  premium: { backgroundColor: '#9B59B6', borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', marginBottom: 24 },
  premiumText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  premiumBadge: { color: '#f59e0b', fontSize: 16, marginBottom: 24 },
  row: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, width: '100%', marginBottom: 8 },
  rowText: { color: '#fff', fontSize: 15 },
  signOut: { marginTop: 8 },
});
```

- [ ] **Step 7: Commit**

```bash
git add mobile/app/(app)/
git commit -m "feat: core app screens — Home, Dump, Result, All, TaskDetail, Profile"
```

---

## Task 13: Railway Deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `.env.railway`

- [ ] **Step 1: Write `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

- [ ] **Step 2: Write `/.env.railway` (template — no real values)**

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=

# AI Models
OPENAI_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=
HUGGINGFACE_API_KEY=

# Infrastructure
REDIS_URL=
ENVIRONMENT=production

# CORS — set to your Expo Web / production domain
ALLOWED_ORIGINS=
```

- [ ] **Step 3: Deploy to Railway**

```bash
# Install Railway CLI if needed
npm install -g @railway/cli
railway login
railway init        # link or create project
railway up          # deploy from backend/
```

- [ ] **Step 4: Add Railway Redis service**

In Railway dashboard: Add Plugin → Redis → copy `REDIS_URL` to Variables.

- [ ] **Step 5: Set all Variables in Railway dashboard**

Fill from `.env.railway` template:
- `SUPABASE_URL` — from Supabase project Settings → API
- `SUPABASE_SERVICE_KEY` — service_role key (NOT anon)
- `SUPABASE_JWT_SECRET` — from Supabase Settings → API → JWT Secret
- `OPENAI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`
- `REDIS_URL` — internal Railway Redis URL
- `ENVIRONMENT=production`
- `ALLOWED_ORIGINS` — your Expo web domain or `*` for MVP

> ⚠️ Never paste `/Users/...` local paths or `localhost` URLs here.

- [ ] **Step 6: Verify deployment**

```bash
curl https://your-app.up.railway.app/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 7: Update mobile env**

In `mobile/.env`:
```env
EXPO_PUBLIC_API_URL=https://your-app.up.railway.app
```

- [ ] **Step 8: Commit**

```bash
git add backend/Dockerfile .env.railway
git commit -m "feat: Railway deployment — Dockerfile + env template"
```

---

## Definition of Done

- [ ] `GET /health` responds on Railway URL
- [ ] Supabase migrations applied (3 files, pgvector enabled)
- [ ] User can register via Supabase Auth
- [ ] Onboarding: 3 screens (welcome → setup → first-dump)
- [ ] Voice dump: record → transcribe (gpt-4o-mini-transcribe) → parse (Groq) → tasks saved
- [ ] Text dump: input → parse → tasks saved
- [ ] Home screen shows today's top 3 tasks
- [ ] All 6 app screens work: Home, Dump, Result, All, TaskDetail, Profile
- [ ] JWT auth on all protected endpoints (no `demo-user` shortcuts)
- [ ] Semantic memory: save + search via halfvec/HNSW
- [ ] Push reminders schedule on task reminder_at
- [ ] RevenueCat paywall opens and handles purchase
- [ ] Backend deployed on Railway, mobile points to Railway URL

---

## Self-Review: Spec Coverage Check

| Feature | Task |
|---------|------|
| Supabase schema (user_profiles, dumps, tasks, memory) | Task 1 |
| STT gpt-4o-mini-transcribe + HuggingFace fallback | Task 2 |
| 3-tier AI router (Groq → Haiku → Sonnet) with retry | Task 3 |
| Task parser (ParsedDump, today_top3 property) | Task 4 |
| Dump API text + voice endpoints | Task 5 |
| Tasks CRUD (today/all/patch/delete) | Task 6 |
| JWT auth (PyJWT, Supabase secret) | Task 1 Step 8 / Task 6 |
| pgvector memory (halfvec + HNSW + match_memories RPC) | Tasks 1–2 SQL + Task 7 |
| Mobile scaffold Zustand + MMKV | Task 8 |
| Audio hook expo-audio (NOT expo-av) | Task 9 |
| UI components (TaskCard/VoiceWave/SphereTab/DumpButton) | Task 9 |
| Root layout + auth guard | Task 10 |
| Onboarding (welcome/setup/first-dump WOW) | Task 11 |
| Core screens (Home/Dump/Result/All/Detail/Profile) | Task 12 |
| Push notifications (schedule/request) | Task 10 |
| RevenueCat (init/isPremium/buyPremium/restore) | Task 10 |
| Railway deployment + Dockerfile | Task 13 |
