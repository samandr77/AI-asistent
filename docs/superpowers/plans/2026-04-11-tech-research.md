# Second Brain — Технический ресёрч: Best Practices 2025/2026

> Исследование актуальных реализаций для каждого технического блока из ТЗ.
> Корректирует и дополняет план `2026-04-11-second-brain-mvp.md`.

---

## 1. Expo Audio Recording

**Источники:** [Expo Audio Docs](https://docs.expo.dev/versions/latest/sdk/audio/), [Production Recorder Guide](https://dev.to/albert_nahas_cdc8469a6ae8/building-a-production-audio-recorder-with-expo-and-react-native-3h7n)

### Изменение vs первоначального плана

❌ **Старый план** использовал `Audio.Recording.createAsync()` из `expo-av` (устаревший API)  
✅ **Актуальный**: `expo-audio` с hook-based API `useAudioRecorder` (доступен с Expo SDK 52+)

### Лучшая реализация

```typescript
// mobile/services/audio.ts
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';

// ✅ Хук для компонента — не глобальный объект
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // RecordingPresets.HIGH_QUALITY: 44100 Hz, 128kbps, AAC, .m4a — оптимально для голоса

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop(): Promise<string> {
    await recorder.stop();
    return recorder.uri!; // путь к файлу
  }

  return { start, stop, recorder };
}
```

```tsx
// mobile/app/(app)/dump.tsx — использование хука
import { useVoiceRecorder } from '../../services/audio';

export default function Dump() {
  const { start, stop } = useVoiceRecorder();

  async function handleStart() {
    await start();
  }

  async function handleStop() {
    const uri = await stop();
    // uri — локальный путь, передаём в API
    const result = await dumpVoice(uri);
  }
}
```

### Конфигурация app.json

```json
{
  "expo": {
    "plugins": [
      [
        "expo-audio",
        {
          "microphonePermission": "$(PRODUCT_NAME) использует микрофон для голосового ввода задач"
        }
      ]
    ]
  }
}
```

### Важно

- `expo-av` помечен как устаревший — не использовать в новых проектах
- Реальная запись работает только в **development build** или продакшне, не в Expo Go
- Для голоса достаточно `HIGH_QUALITY` (не `HIGH_QUALITY_STEREO`) — моно, меньше файл

---

## 2. Speech-to-Text: gpt-4o-mini-transcribe вместо whisper-1

**Источник:** [OpenAI Speech-to-Text Docs](https://developers.openai.com/api/docs/guides/speech-to-text)

### Изменение vs первоначального плана

❌ **Старый план**: `whisper-1`  
✅ **Актуальный**: `gpt-4o-mini-transcribe` (рекомендован OpenAI с декабря 2025)

| Модель | Точность | Цена | Стриминг |
|--------|----------|------|---------|
| `whisper-1` | Хорошая | $0.006/мин | Нет |
| `gpt-4o-transcribe` | Лучшая | $0.006/мин | Да |
| `gpt-4o-mini-transcribe` | Отличная | $0.003/мин | Да |

### Лучшая реализация

```python
# backend/services/stt.py
import io
from openai import AsyncOpenAI
from config import settings

openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.m4a",
    language: str | None = None,
    context_prompt: str | None = None,  # ✅ подсказка для точности
) -> str:
    if not audio_bytes:
        raise ValueError("Cannot transcribe empty audio")

    ext = filename.rsplit(".", 1)[-1].lower()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = f"audio.{ext}"

    kwargs = {
        "model": "gpt-4o-mini-transcribe",  # ✅ актуальная модель
        "file": audio_file,
        "response_format": "text",
    }

    # ✅ Передаём язык если известен (ускоряет и точнее)
    if language:
        kwargs["language"] = language

    # ✅ Prompt для контекста (задачи, имена, термины)
    if context_prompt:
        kwargs["prompt"] = context_prompt

    response = await openai_client.audio.transcriptions.create(**kwargs)
    return response

# ✅ Пример context_prompt: "Задачи, дедлайны, встречи, покупки, напоминания."
```

### HuggingFace как бесплатный fallback

```python
# backend/services/stt.py — fallback на HuggingFace
import httpx
from config import settings

HF_WHISPER_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3"

async def transcribe_via_huggingface(audio_bytes: bytes) -> str:
    """Бесплатный fallback через HuggingFace Inference API (лимиты по часу)"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            HF_WHISPER_URL,
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
    """Основной + fallback"""
    try:
        return await transcribe_audio(audio_bytes, filename)
    except Exception as e:
        # Если OpenAI недоступен или кончился баланс — HuggingFace
        return await transcribe_via_huggingface(audio_bytes)
```

---

## 3. LLM Router с Retry и Fallback

**Источники:** [LLM Routing Best Practices](https://www.getmaxim.ai/articles/top-5-llm-routing-techniques/), [Groq Pricing](https://groq.com/pricing)

### Актуальные цены (апрель 2026)

| Провайдер/Модель | Input | Output | Скорость |
|-----------------|-------|--------|---------|
| Groq Llama 3.3 70B | $0.59/M | $0.79/M | 394 tok/s |
| Claude Haiku 4.5 | ~$0.80/M | ~$4/M | — |
| Claude Sonnet 4.6 | ~$3/M | ~$15/M | — |

**Groq Free Tier**: 500K tokens/день, 6K tokens/мин — достаточно для MVP

### Лучшая реализация с retry + fallback

```python
# backend/services/ai_router.py
import asyncio
from enum import Enum
from groq import AsyncGroq
from anthropic import AsyncAnthropic
from config import settings
import logging

logger = logging.getLogger(__name__)

class AITier(str, Enum):
    cheap = "cheap"      # Groq Llama 3.3 70B — быстро и дёшево
    medium = "medium"    # Claude Haiku 4.5 — качество
    premium = "premium"  # Claude Sonnet 4.6 — сложные диалоги

groq_client = AsyncGroq(api_key=settings.groq_api_key)
anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)

# ✅ Цепочка fallback: если cheap недоступен → medium
FALLBACK_CHAIN = {
    AITier.cheap: AITier.medium,
    AITier.medium: AITier.premium,
    AITier.premium: None,
}

async def _call_groq(system: str, user: str, max_tokens: int) -> str:
    resp = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
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

TIER_CALLERS = {
    AITier.cheap: lambda s, u, t: _call_groq(s, u, t),
    AITier.medium: lambda s, u, t: _call_anthropic("claude-haiku-4-5-20251001", s, u, t),
    AITier.premium: lambda s, u, t: _call_anthropic("claude-sonnet-4-6", s, u, t),
}

async def complete(
    system: str,
    user: str,
    tier: AITier = AITier.cheap,
    max_tokens: int = 2000,
    retries: int = 2,  # ✅ повторная попытка перед fallback
) -> str:
    current_tier = tier

    while current_tier is not None:
        for attempt in range(retries + 1):
            try:
                result = await TIER_CALLERS[current_tier](system, user, max_tokens)
                if attempt > 0 or current_tier != tier:
                    logger.info(f"AI router: used {current_tier} (attempt {attempt+1})")
                return result
            except Exception as e:
                if attempt < retries:
                    await asyncio.sleep(0.5 * (attempt + 1))  # экспоненциальная задержка
                    continue
                logger.warning(f"AI router: {current_tier} failed after {retries+1} attempts: {e}")
                break

        # Переходим к следующему уровню
        current_tier = FALLBACK_CHAIN.get(current_tier)

    raise RuntimeError("All AI providers failed")
```

---

## 4. pgvector: HNSW индекс + Auto-Embeddings

**Источник:** [Supabase AI Docs](https://supabase.com/docs/guides/ai), [Automatic Embeddings](https://supabase.com/docs/guides/ai/automatic-embeddings)

### Изменение vs первоначального плана

❌ **Старый план**: `ivfflat` индекс  
✅ **Актуальный**: `hnsw` — лучше для recall, не требует предварительной тренировки

❌ **Старый план**: `vector(1536)` — стандартный тип  
✅ **Актуальный**: `halfvec(1536)` — вдвое меньше памяти при той же точности

### Лучшая схема для памяти

```sql
-- supabase/migrations/002_memory_hnsw.sql

-- ✅ halfvec вместо vector — в 2x меньше места
create table public.memory_embeddings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  embedding halfvec(1536),  -- ✅ OpenAI text-embedding-3-small = 1536 dim
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ✅ HNSW индекс: лучший recall, не требует VACUUM для обновления
-- vs IVFFlat который нужно перестраивать при росте данных
create index memory_hnsw_idx on public.memory_embeddings
  using hnsw (embedding halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);  -- m=16 оптимально для большинства задач

-- RPC функция для семантического поиска
create or replace function match_memories(
  user_id_input uuid,
  query_embedding halfvec(1536),
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (content text, similarity float)
language sql stable
as $$
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

### Auto-Embeddings через триггеры (рекомендация Supabase)

```sql
-- ✅ Автоматически создаёт эмбеддинг при добавлении задачи в память
-- Использует pgmq (очередь) + pg_cron (расписание) + Edge Function

-- Включить расширения
create extension if not exists pgmq;
create extension if not exists pg_cron;

-- Очередь для задач эмбеддинга
select pgmq.create('embedding_jobs');

-- Функция постановки в очередь
create or replace function util.queue_embedding_job()
returns trigger language plpgsql as $$
begin
  perform pgmq.send(
    'embedding_jobs',
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'id', new.id,
      'content', new.content
    )
  );
  return new;
end;
$$;

-- Триггер на вставку в memory_embeddings
create trigger auto_embed_on_insert
  after insert on public.memory_embeddings
  for each row execute function util.queue_embedding_job();

-- pg_cron: обрабатывать очередь каждую минуту
select cron.schedule(
  'process-embedding-jobs',
  '* * * * *',
  $$select net.http_post(
    url := get_service_url() || '/functions/v1/generate-embeddings',
    headers := '{"Authorization": "Bearer ' || current_setting('app.service_key') || '"}'::jsonb
  )$$
);
```

### Memory Store с halfvec

```python
# backend/services/memory_store.py — обновлённая версия
from openai import AsyncOpenAI
from database import get_supabase
from config import settings

openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

async def _embed(text: str) -> list[float]:
    """text-embedding-3-small: 1536 dim, дешевле 3-large"""
    resp = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        dimensions=1536,  # ✅ явно указываем для halfvec(1536)
    )
    return resp.data[0].embedding

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
        "query_embedding": query_embedding,  # halfvec принимает list[float]
        "match_count": limit,
        "match_threshold": threshold,
    }).execute()
    return [row["content"] for row in result.data]
```

---

## 5. FastAPI + Supabase Auth: правильный JWT middleware

**Источник:** [Validating Supabase JWT in FastAPI](https://dev.to/zwx00/validating-a-supabase-jwt-locally-with-python-and-fastapi-59jf)

### Изменение vs первоначального плана

❌ **Старый план**: `user_id = "demo-user"` — заглушка без auth  
✅ **Актуальный**: PyJWT декодирование токена Supabase, извлечение `sub` как user_id

```python
# backend/api/deps.py — dependency для всех защищённых роутов
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings

http_bearer = HTTPBearer(auto_error=False)

async def get_current_user_id(
    cred: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> str:
    """
    Декодирует Supabase JWT и возвращает user_id (sub claim).
    Добавлять как Depends() к любому защищённому endpoint.
    """
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
        )
    try:
        payload = jwt.decode(
            cred.credentials,
            settings.supabase_jwt_secret,  # JWT secret из Supabase Dashboard > Settings > API
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload["sub"]  # ✅ sub = user UUID в Supabase
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

# Использование в endpoints:
# @router.post("/text")
# async def dump_text(req: TextDumpRequest, user_id: str = Depends(get_current_user_id)):
#     ...
```

```python
# backend/config.py — добавить поле
class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str  # ✅ из Supabase Dashboard > Settings > API > JWT Secret
    openai_api_key: str
    groq_api_key: str
    anthropic_api_key: str
    huggingface_api_key: str = ""  # опционально — для STT fallback
    redis_url: str = "redis://localhost:6379"
    environment: str = "development"
```

---

## 6. Zustand + MMKV: персистентный стор

**Источники:** [Zustand MMKV](https://dev.to/mehdifaraji/zustand-mmkv-storage-blazing-fast-persistence-for-zustand-in-react-native-3ef1), [State Management Guide 2025](https://reactnativeexample.com/react-native-global-state-management-complete-guide-2025/)

### Изменение vs первоначального плана

❌ **Старый план**: Zustand без персистентности — всё сбрасывается при перезапуске  
✅ **Актуальный**: Zustand + MMKV (в 10x быстрее AsyncStorage)

```bash
# Установка
npx expo install react-native-mmkv zustand
```

```typescript
// mobile/store/useAppStore.ts — с персистентностью
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

// ✅ MMKV storage адаптер для Zustand
const mmkv = new MMKV({ id: 'app-store' });
const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.delete(key),
};

interface AppState {
  tasks: Task[];
  todayTasks: Task[];
  profile: UserProfile | null;
  isOnboarded: boolean;
  // ... actions
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      tasks: [],
      todayTasks: [],
      profile: null,
      isOnboarded: false,
      setTasks: (tasks) => set({ tasks }),
      setTodayTasks: (tasks) => set({ todayTasks: tasks }),
      setProfile: (profile) => set({ profile }),
      markDone: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === id ? { ...t, is_done: true } : t),
          todayTasks: s.todayTasks.map((t) => t.id === id ? { ...t, is_done: true } : t),
        })),
      setOnboarded: (v) => set({ isOnboarded: v }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => mmkvStorage), // ✅ MMKV вместо AsyncStorage
      // ✅ Сохранять только профиль и флаг онбординга (не задачи — они в БД)
      partialize: (state) => ({
        profile: state.profile,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);
```

---

## 7. Expo Router v3: правильная структура

**Источник:** [Expo Router Core Concepts](https://docs.expo.dev/router/basics/core-concepts/)

### Актуальная структура с route groups

```
mobile/app/
├── _layout.tsx           # Root layout: проверяет isOnboarded → редирект
├── (onboarding)/
│   ├── _layout.tsx       # Stack navigator для онбординга
│   ├── welcome.tsx       # /welcome
│   ├── setup.tsx         # /setup
│   └── first-dump.tsx    # /first-dump
└── (app)/
    ├── _layout.tsx       # Tabs navigator для главного приложения
    ├── index.tsx         # / (Home)
    ├── dump.tsx          # /dump
    ├── result.tsx        # /result
    ├── all.tsx           # /all
    ├── profile.tsx       # /profile
    └── task/
        └── [id].tsx      # /task/123
```

```tsx
// mobile/app/_layout.tsx — Root: определяет начальный маршрут
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAppStore } from '../store/useAppStore';

export default function RootLayout() {
  const { isOnboarded } = useAppStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const inOnboarding = segments[0] === '(onboarding)';
    if (!isOnboarded && !inOnboarding) {
      router.replace('/(onboarding)/welcome');  // ✅ редирект если не онбордился
    } else if (isOnboarded && inOnboarding) {
      router.replace('/(app)/');  // ✅ пропускаем онбординг если уже прошли
    }
  }, [isOnboarded, segments]);

  return <Slot />;
}
```

```tsx
// mobile/app/(app)/_layout.tsx — Tab navigator
import { Tabs } from 'expo-router';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ tabBarStyle: { backgroundColor: '#0A0A0A', borderTopColor: '#1A1A1A' } }}>
      <Tabs.Screen name="index" options={{ title: 'Сегодня', tabBarIcon: () => '🏠' }} />
      <Tabs.Screen name="all" options={{ title: 'Все задачи', tabBarIcon: () => '📋' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: () => '👤' }} />
      {/* Скрытые экраны — не показываются в таббаре */}
      <Tabs.Screen name="dump" options={{ href: null }} />
      <Tabs.Screen name="result" options={{ href: null }} />
    </Tabs>
  );
}
```

---

## 8. RevenueCat: правильная интеграция

**Источник:** [RevenueCat Expo Docs](https://www.revenuecat.com/docs/getting-started/installation/expo)

### Ключевые выводы из ресёрча

1. **Expo Go не работает** для реальных покупок — только mock preview
2. **SDK v9.7.6+** поддерживает iOS + Android + Web из одного кода
3. **Web Billing** использует Stripe под капотом

### Правильная реализация

```bash
# ✅ Обязательно — dev client для тестирования покупок
npx expo install expo-dev-client
npx expo install react-native-purchases react-native-purchases-ui
```

```tsx
// mobile/services/purchases.ts
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { MMKV } from 'react-native-mmkv';

const store = new MMKV({ id: 'purchases' });

export function initRevenueCat() {
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  }

  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
    : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;

  Purchases.configure({ apiKey });
}

export async function isPremium(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return typeof info.entitlements.active['premium'] !== 'undefined';
}

export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.monthly ?? null;
}

export async function purchasePremium(): Promise<boolean> {
  const pkg = await getMonthlyPackage();
  if (!pkg) return false;
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return typeof customerInfo.entitlements.active['premium'] !== 'undefined';
}
```

```tsx
// mobile/app/(app)/profile.tsx — кнопка подписки
import { initRevenueCat, isPremium, purchasePremium } from '../../services/purchases';
import { useEffect, useState } from 'react';

export default function Profile() {
  const [hasPremium, setHasPremium] = useState(false);

  useEffect(() => {
    initRevenueCat();
    isPremium().then(setHasPremium);
  }, []);

  return (
    // ...
    <>
      {!hasPremium && (
        <Pressable onPress={async () => {
          const ok = await purchasePremium();
          if (ok) setHasPremium(true);
        }}>
          <Text>⭐ Получить Премиум</Text>
        </Pressable>
      )}
    </>
  );
}
```

---

## 9. Push Notifications с Expo

**Источник:** [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)

### Архитектура

```
Expo Push Service → APNs (iOS) / FCM (Android) → Устройство
```

### Реализация: запрос + расписание

```typescript
// mobile/services/notifications.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// ✅ Настройка обработчика уведомлений при получении
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function requestPushPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function scheduleEveningReminder(name: string): Promise<void> {
  // Отменить существующие чтобы не дублировать
  await Notifications.cancelAllScheduledNotificationsAsync();

  // ✅ Вечернее напоминание в 20:00 ежедневно
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${name}, как прошёл день? 🌙`,
      body: 'Пора разгрузиться перед сном. Что накопилось?',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });

  // ✅ Утреннее напоминание в 9:00
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Доброе утро, ${name} ☀️`,
      body: 'Что у нас на сегодня? Нажми чтобы увидеть план.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}
```

---

## 10. Обновлённый .env.example

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...           # service_role key
SUPABASE_JWT_SECRET=your-jwt-secret   # ✅ NEW: из Settings > API > JWT Secret

# AI Models
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
HUGGINGFACE_API_KEY=hf_...            # ✅ NEW: для STT fallback (бесплатно)

# Infrastructure
REDIS_URL=redis://localhost:6379
ENVIRONMENT=development

# Mobile (EXPO_PUBLIC_ виден на клиенте)
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_RC_IOS_KEY=appl_...       # RevenueCat iOS key
EXPO_PUBLIC_RC_ANDROID_KEY=goog_...   # RevenueCat Android key
```

---

## Сводная таблица: что изменить в плане

| Блок | Было в плане | Актуально | Критичность |
|------|-------------|-----------|-------------|
| Expo Audio | `Audio.Recording.createAsync` (expo-av) | `useAudioRecorder` (expo-audio) | 🔴 Критично — expo-av deprecated |
| STT модель | `whisper-1` | `gpt-4o-mini-transcribe` | 🟡 Важно — точнее и дешевле |
| pgvector индекс | `ivfflat` | `hnsw` | 🟡 Важно — лучше recall |
| Тип хранения векторов | `vector(1536)` | `halfvec(1536)` | 🟢 Оптимизация — экономия памяти |
| FastAPI auth | `user_id = "demo-user"` | JWT decode + `sub` | 🔴 Критично — без этого нет безопасности |
| Zustand | Без персистентности | MMKV + persist middleware | 🟡 Важно — иначе данные теряются |
| RevenueCat | `Purchases.configure` без dev build | + `expo-dev-client` обязателен | 🟡 Важно — иначе не тестировать |
| AI Fallback | Нет fallback | Retry + fallback chain | 🟡 Важно — production resilience |
| Groq модель | `llama-3.3-70b-versatile` | ✅ Верно | — |
| STT fallback | Не реализован | HuggingFace Whisper Large v3 | 🟢 Бонус — бесплатный backup |

---

## Источники

- [Expo Audio Documentation](https://docs.expo.dev/versions/latest/sdk/audio/)
- [OpenAI Speech-to-Text Guide](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Supabase pgvector Guide](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Supabase Automatic Embeddings](https://supabase.com/docs/guides/ai/automatic-embeddings)
- [Supabase Semantic Search](https://supabase.com/docs/guides/ai/semantic-search)
- [LLM Routing Top 5 Techniques](https://www.getmaxim.ai/articles/top-5-llm-routing-techniques/)
- [Groq Pricing](https://groq.com/pricing)
- [Groq Rate Limits](https://console.groq.com/docs/rate-limits)
- [FastAPI + Supabase JWT Validation](https://dev.to/zwx00/validating-a-supabase-jwt-locally-with-python-and-fastapi-59jf)
- [Zustand MMKV for React Native](https://dev.to/mehdifaraji/zustand-mmkv-storage-blazing-fast-persistence-for-zustand-in-react-native-3ef1)
- [Expo Router Core Concepts](https://docs.expo.dev/router/basics/core-concepts/)
- [RevenueCat Expo Integration](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [HuggingFace Inference API](https://huggingface.co/docs/inference-providers/index)
- [Whisper Large v3 on HuggingFace](https://huggingface.co/openai/whisper-large-v3)
- [Best STT APIs 2026 Comparison](https://deepgram.com/learn/best-speech-to-text-apis-2026)
