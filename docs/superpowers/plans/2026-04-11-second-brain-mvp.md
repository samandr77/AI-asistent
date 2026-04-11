# Second Brain MVP — Implementation Plan

> **Для агентов:** используй superpowers:executing-plans для выполнения по шагам. Каждый шаг — checkbox `- [ ]`.

**Цель:** Мобильное + веб-приложение "Второй мозг" — пользователь сбрасывает хаотичный поток мыслей голосом, AI структурирует всё в задачи и проактивно управляет его жизнью.

**Архитектура:** React Native (Expo Router) — одна кодовая база iOS/Android/Web PWA. FastAPI бэкенд с трёхуровневым AI-роутером (Groq/Llama → Claude Haiku → Claude Sonnet). Supabase = PostgreSQL + pgvector + Auth + Realtime. Redis для кэша. OpenAI Whisper для STT.

**Стек:** Python 3.12, FastAPI, Supabase (PostgreSQL + pgvector + Auth), Redis, OpenAI Whisper, Groq API (Llama 3.3 70B), Anthropic Claude (Haiku + Sonnet), React Native, Expo SDK 53, Expo Router v4, RevenueCat, PostHog, Railway.

---

## Структура проекта

```
second-brain/
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   │   ├── user.py
│   │   └── task.py
│   ├── api/
│   │   ├── auth.py
│   │   ├── dump.py
│   │   ├── tasks.py
│   │   └── memory.py
│   ├── services/
│   │   ├── stt.py
│   │   ├── ai_router.py
│   │   ├── parser.py
│   │   └── memory_store.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
│       ├── conftest.py
│       ├── test_stt.py
│       ├── test_parser.py
│       ├── test_dump.py
│       └── test_tasks.py
│
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── (onboarding)/
│   │   │   ├── welcome.tsx
│   │   │   ├── setup.tsx
│   │   │   └── first-dump.tsx
│   │   └── (app)/
│   │       ├── index.tsx
│   │       ├── dump.tsx
│   │       ├── result.tsx
│   │       ├── all.tsx
│   │       ├── task/[id].tsx
│   │       └── profile.tsx
│   ├── components/
│   │   ├── TaskCard.tsx
│   │   ├── VoiceWave.tsx
│   │   ├── SphereTab.tsx
│   │   └── DumpButton.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── audio.ts
│   │   └── purchases.ts
│   ├── store/
│   │   └── useAppStore.ts
│   ├── constants/
│   │   └── spheres.ts
│   └── .env.example
│
├── supabase/
│   └── migrations/
│       ├── 001_init.sql
│       ├── 002_pgvector.sql
│       └── 003_memory_rpc.sql
│
├── .env.example
└── .env.railway
```

---

## Разбивка по подсистемам

1. **Backend + AI Layer** (Tasks 1–5) — FastAPI, Supabase, Whisper, LLM-роутер
2. **Mobile App** (Tasks 6–11) — Expo, онбординг, основные экраны
3. **Инфраструктура** (Tasks 12–13) — Push-уведомления, RevenueCat, деплой Railway

---

## Task 1: Backend Foundation

Создаёт скелет бэкенда: Supabase схема, конфигурация, FastAPI entry point, базовые тесты.

### 1.1 Supabase миграция — базовые таблицы

- [ ] Написать `supabase/migrations/001_init.sql`.

  Что должно быть в файле:
  - Включить расширение pgvector
  - Таблица `user_profiles` — расширяет auth.users Supabase. Поля: id (FK → auth.users), name, language (default 'ru'), role (mom/freelancer/student/entrepreneur/other), living_with (alone/couple/with_kids), peak_hours (morning/afternoon/evening), created_at
  - Таблица `dumps` — хранит сырые транскрипции для истории и повторной обработки. Поля: id, user_id (FK → auth.users), raw_text, audio_url (ссылка на Supabase Storage, опционально), status (processing/done/failed, default 'done'), created_at. Включить RLS: пользователь видит только свои dumps
  - Таблица `tasks`. Поля: id, user_id (FK → auth.users), dump_id (FK → dumps, nullable, SET NULL при удалении dump), title, notes, sphere (work/family/study/health/travel), priority (1=низкий, 2=средний, 3=высокий, default 2), deadline (timestamptz, nullable), reminder_at (timestamptz, nullable), is_done (boolean, default false), is_today (boolean, default false), created_at, updated_at. Включить RLS: пользователь видит только свои задачи
  - Таблица `memory_embeddings`. Поля: id, user_id (FK → auth.users), content (text), embedding (vector(1536)), metadata (jsonb, default {}), created_at. Включить RLS: пользователь видит только свои embeddings
  - 4 индекса на tasks для частых запросов: (user_id, is_today, is_done) WHERE is_done=false; (user_id, sphere, is_done) WHERE is_done=false; (user_id, priority DESC, created_at DESC); индекс на dumps (user_id, created_at DESC)
  - ivfflat индекс на memory_embeddings по полю embedding (vector_cosine_ops, lists=100)
  - Триггерная функция set_updated_at() которая обновляет updated_at=now() перед UPDATE. Повесить триггер на таблицу tasks

- [ ] Применить миграцию через Supabase CLI: `supabase db push`

### 1.2 Backend конфигурация

- [ ] Создать `backend/config.py` — класс Settings на базе pydantic-settings. Поля: supabase_url, supabase_service_key (service_role ключ, не anon), supabase_jwt_secret (из Supabase → Settings → API → JWT Secret), openai_api_key, groq_api_key, anthropic_api_key, redis_url (default: redis://localhost:6379), environment (default: development), allowed_origins (строка через запятую, default: http://localhost:8081). Читать из файла .env.

- [ ] Создать `.env.example` со всеми переменными (значения-заглушки, без реальных ключей).

- [ ] Создать `backend/database.py` — синглтон Supabase клиент через create_client. Функция get_supabase() возвращает переиспользуемый экземпляр.

### 1.3 FastAPI entry point

- [ ] Создать `backend/main.py`. Что настроить:
  - Создать FastAPI приложение
  - Создать Limiter из slowapi с key_func=get_remote_address, зарегистрировать как app.state.limiter
  - Добавить обработчик ошибки RateLimitExceeded
  - CORS middleware: список origins брать из settings.allowed_origins (split по запятой)
  - Подключить роутеры: /auth, /dump, /tasks, /memory
  - GET /health возвращает {"status": "ok"}

- [ ] Установить зависимости в `backend/requirements.txt`: fastapi, uvicorn[standard], pydantic-settings, supabase, openai, anthropic, groq, redis, python-multipart, pytest, pytest-asyncio, httpx, PyJWT, slowapi

- [ ] Создать `backend/tests/conftest.py`. Что внутри:
  - Константа TEST_USER_ID = "test-user-uuid-1234"
  - Асинхронная фикстура client — AsyncClient поверх ASGITransport с замоканным auth.get_current_user (возвращает TEST_USER_ID)
  - Фикстура test_user_id возвращает TEST_USER_ID

- [ ] Запустить сервер `uvicorn main:app --reload --port 8000`, проверить GET /health → `{"status": "ok"}`

- [ ] Commit: "feat: backend foundation — FastAPI + Supabase schema"

---

## Task 2: Speech-to-Text (Whisper)

Создаёт сервис транскрипции аудио через OpenAI Whisper API.

### 2.1 Тест STT (TDD — сначала тест)

- [ ] Создать `backend/tests/test_stt.py`. Два теста:
  - test_transcribe_returns_text: мокает openai_client.audio.transcriptions.create, проверяет что функция transcribe_audio возвращает текст из ответа API
  - test_transcribe_empty_audio_raises: проверяет что на пустые bytes поднимается ValueError с текстом "empty"

- [ ] Запустить тест, убедиться в FAIL (модуль ещё не создан)

### 2.2 Реализация STT сервиса

- [ ] Создать `backend/services/stt.py`. Что делает:
  - Синглтон AsyncOpenAI клиент
  - Список поддерживаемых форматов: m4a, mp3, wav, webm, ogg
  - Функция transcribe_audio(audio_bytes: bytes, filename: str) → str
    - Если bytes пустые — поднять ValueError "Cannot transcribe empty audio"
    - Определить расширение из filename, если не в списке — использовать m4a
    - Создать BytesIO объект с именем файла (нужно для Whisper API)
    - Вызвать openai_client.audio.transcriptions.create с model="whisper-1", language=None (авто)
    - Вернуть response.text

- [ ] Запустить тесты, убедиться в PASS

- [ ] Commit: "feat: Whisper STT service"

---

## Task 3: AI Router + Task Parser

Создаёт трёхуровневый роутер для LLM-запросов и сервис парсинга дампа в задачи.

### 3.1 Модели задачи

- [ ] Создать `backend/models/task.py`. Что описать:
  - Enum Sphere: work, family, study, health, travel
  - Enum Priority: low=1, medium=2, high=3
  - Pydantic модель ParsedTask: title, sphere, priority, deadline (Optional[datetime]=None), notes (Optional[str]=None), is_today (bool=False)
  - Pydantic модель ParsedDump: tasks (list[ParsedTask]), а также @property today_top3 — возвращает до 3 задач с is_today=True, отсортированных по priority (убывание). today_top3 — это именно Python-свойство (@property), а не поле модели, поэтому оно НЕ сериализуется автоматически в JSON и НЕ передаётся в конструктор Pydantic

### 3.2 Тест парсера (TDD)

- [ ] Создать `backend/tests/test_parser.py`. Два теста:
  - test_parse_dump_returns_tasks: мокает ai_router.complete, передаёт пример JSON ответа LLM (5 задач), проверяет количество задач, сферу, приоритет, что today_top3 содержит ≤3 задач с is_today=True, что дедлайн распарсился
  - test_parse_dump_empty_text_raises: проверяет ValueError "empty" на пустой строке

- [ ] Убедиться в FAIL

### 3.3 AI Router

- [ ] Создать `backend/services/ai_router.py`. Что описать:
  - Enum AITier: cheap (Groq Llama 3.3 70B — $0.59/M input, $0.79/M output), medium (Claude Haiku — $0.80/M input, $4/M output), premium (Claude Sonnet — $3/M input, $15/M output)
  - Синглтоны AsyncGroq и AsyncAnthropic клиентов
  - Словарь TIER_MODELS: cheap → (groq, llama-3.3-70b-versatile), medium → (anthropic, claude-haiku-4-5-20251001), premium → (anthropic, claude-sonnet-4-6)
  - Приватные хелперы _call_groq и _call_anthropic: формируют сообщения, вызывают API, возвращают text
  - Публичная функция complete(system, user, tier=cheap, max_tokens=2000):
    - Определить провайдера из TIER_MODELS
    - Попробовать вызвать, при любом Exception — пройти по fallback цепочке: medium → premium
    - Если все три уровня упали — поднять RuntimeError "All AI providers failed"

### 3.4 Parser промпт

- [ ] Создать `backend/services/parser.py`. Что описать:
  - Системный промпт PARSE_SYSTEM. Инструкции для LLM: каждое дело/намерение = отдельная задача, определить сферу, приоритет, is_today, дедлайн в ISO 8601 UTC вычисляя из фраз "в пятницу/завтра/через неделю", отвечать ТОЛЬКО валидным JSON без markdown
  - Функция parse_dump(text, user_context) → ParsedDump:
    - Если text пустой — ValueError
    - Собрать строку контекста из user_context (role, living_with, peak_hours)
    - Добавить текущее время в user_prompt (для вычисления дедлайнов)
    - Вызвать ai_router.complete с tier=cheap
    - Очистить ответ от markdown-обёртки (```json...```) если присутствует
    - Попробовать json.loads, при JSONDecodeError — поднять ValueError с текстом ошибки
    - Проверить что в JSON есть ключ "tasks" со списком
    - Вернуть ParsedDump(**data)

- [ ] Запустить тесты, убедиться в 2 PASS

- [ ] Commit: "feat: AI router + dump parser (Groq/Claude)"

---

## Task 4: Dump API Endpoint

Создаёт REST эндпоинты для приёма текстового и голосового дампа, CRUD задач.

### 4.1 Тест dump endpoint (TDD)

- [ ] Создать `backend/tests/test_dump.py`. Два теста:
  - test_dump_text_returns_tasks: мокает parse_dump и save_tasks, POST /dump/text с валидным текстом, проверяет status=200, наличие tasks и today_top3 в ответе, что today_top3[0] — задача с наивысшим приоритетом
  - test_dump_text_empty_returns_422: POST /dump/text с пустым text, ожидать 422

- [ ] Убедиться в FAIL

### 4.2 Dump endpoint

- [ ] Создать `backend/api/dump.py`. Что описать:
  - Pydantic модель TextDumpRequest: поля text (с валидатором — не пустая строка), user_context (dict, default_factory=dict)
  - Константа MAX_AUDIO_SIZE = 25 * 1024 * 1024 (лимит Whisper API)
  - Async функция save_tasks(parsed, user_id, raw_text) → (dump_id, list[task_ids]):
    - Создать запись в таблице dumps (user_id, raw_text, status='done')
    - Получить dump_id из результата
    - Вставить все задачи в таблицу tasks с привязкой dump_id
    - Вернуть кортеж (dump_id, список id задач)
  - POST /text с rate limit 20/minute:
    - Принимает TextDumpRequest + user_id через Depends(get_current_user)
    - Вызывает parse_dump → save_tasks
    - Возвращает dump_id, tasks (все задачи), today_top3 (через @property), task_ids
  - POST /voice с rate limit 10/minute:
    - Принимает UploadFile + user_id через Depends(get_current_user)
    - Читает аудио байты, проверяет размер ≤ MAX_AUDIO_SIZE (иначе 413)
    - Вызывает transcribe_audio → parse_dump → save_tasks
    - Возвращает dump_id, transcription, tasks, today_top3, task_ids
  - Limiter импортировать из main (не создавать новый экземпляр)

- [ ] Запустить тесты, убедиться в 2 PASS

### 4.3 Tasks CRUD endpoint

- [ ] Создать `backend/api/tasks.py`. Эндпоинты:
  - GET /tasks/today — возвращает топ 3 задачи пользователя с is_today=True и is_done=False, отсортированные по priority DESC. Требует user_id через Depends(get_current_user)
  - GET /tasks/ — все незавершённые задачи с пагинацией (limit, offset) и опциональным фильтром по sphere. Requires user_id
  - PATCH /tasks/{task_id} — обновить задачу. Модель TaskUpdate: все поля Optional (is_done, title, deadline, reminder_at, notes, is_today, sphere). Использовать model_dump(exclude_unset=True) чтобы не перезаписывать незатронутые поля, и чтобы можно было явно передать null для очистки deadline. Добавить updated_at = datetime.now(timezone.utc). Проверить что задача принадлежит user_id (через .eq("user_id", user_id)), иначе 404
  - DELETE /tasks/{task_id} — удалить задачу пользователя

- [ ] Commit: "feat: dump + tasks CRUD API endpoints"

### 4.4 JWT аутентификация

- [ ] Создать `backend/auth.py`. Что описать:
  - HTTPBearer security schema
  - Функция get_current_user(credentials: HTTPAuthorizationCredentials) → str (user_id):
    - Извлечь токен из credentials
    - jwt.decode с алгоритмом HS256, audience="authenticated", ключ из settings.supabase_jwt_secret
    - Получить sub (user_id) из payload, если нет — 401
    - При ExpiredSignatureError — 401 "Token expired"
    - При InvalidTokenError — 401 с деталью ошибки

- [ ] Проверить вручную: запрос без токена на /dump/text возвращает 403

- [ ] Commit: "feat: JWT authentication via Supabase secret"

### 4.5 Auth + profile API

- [ ] Создать `backend/api/auth.py`. Два эндпоинта:
  - GET /auth/me — возвращает user_profiles запись текущего пользователя. Если профиль не создан — возвращает {"id": user_id, "profile": null}
  - POST /auth/profile — upsert профиля: принимает dict, добавляет id=user_id, вставляет/обновляет через .upsert()

---

## Task 5: User Memory (pgvector)

Создаёт семантическую память пользователя на базе pgvector: сохранение и поиск по близости.

### 5.1 SQL миграции pgvector

- [ ] Написать `supabase/migrations/002_pgvector.sql` — создать таблицу memory_embeddings (если не создана в 001). Таблица уже описана в Task 1; этот файл может быть пустым или содержать дополнительные настройки pgvector.

- [ ] Написать `supabase/migrations/003_memory_rpc.sql` — создать SQL функцию match_memories(user_id_input uuid, query_embedding vector(1536), match_count int). Функция должна:
  - Выбрать content из memory_embeddings WHERE user_id = user_id_input
  - Отсортировать по косинусному расстоянию (оператор pgvector <=>)
  - Вернуть таблицу (content text, similarity float) где similarity = 1 - расстояние
  - Ограничить результат match_count строками

- [ ] Применить: `supabase db push`

### 5.2 Memory store сервис

- [ ] Создать `backend/services/memory_store.py`. Что описать:
  - Синглтон AsyncOpenAI клиент
  - Приватная функция _embed(text: str) → list[float]: вызывает embeddings.create с model="text-embedding-3-small", возвращает вектор
  - save_memory(user_id, content, metadata) → str (id): создаёт embedding, вставляет в memory_embeddings, возвращает id
  - search_relevant_memory(user_id, query, limit=5) → list[str]: создаёт embedding запроса, вызывает RPC match_memories, возвращает список content строк

### 5.3 Memory API endpoint

- [ ] Создать `backend/api/memory.py`. Два эндпоинта:
  - POST /memory/search — принимает query и limit, вызывает search_relevant_memory, возвращает {"results": [...]}
  - GET /memory/profile — возвращает последние 20 записей памяти пользователя (id, content, metadata, created_at)

- [ ] Commit: "feat: pgvector semantic memory store + API"

---

## Task 6: Mobile App Scaffold

Создаёт Expo проект и базовую инфраструктуру мобильного приложения.

### 6.1 Создать Expo проект

- [ ] Инициализировать проект: `npx create-expo-app@latest mobile --template blank-typescript`

- [ ] Установить зависимости:
  - expo-router, expo-audio (SDK 53 — не expo-av!), @supabase/supabase-js, zustand, axios
  - expo-notifications, expo-build-properties, expo-background-task
  - @react-native-async-storage/async-storage (для Zustand persistence)

- [ ] Настроить `mobile/app.json`:
  - scheme: "secondbrain" (нужен для deep links)
  - web.bundler: "metro"
  - newArchEnabled: true
  - Плагины: expo-router, expo-audio с разрешением микрофона ("Нужен микрофон для голосового ввода"), expo-notifications

- [ ] Создать `mobile/.env.example` с переменными: EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_REVENUECAT_IOS_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_KEY

### 6.2 Zustand Store

- [ ] Создать `mobile/store/useAppStore.ts`. Стейт и действия:
  - user (UserProfile | null) — профиль пользователя
  - todayTasks (Task[]) — топ 3 задачи на сегодня
  - allTasks (Task[]) — все задачи
  - isOnboarded (boolean) — прошёл ли онбординг
  - isLoading (boolean) — флаг загрузки (НЕ персистировать)
  - Действия: setUser, setTodayTasks, setAllTasks, updateTask, deleteTask, setOnboarded, setLoading
  - Подключить persist middleware с AsyncStorage. В partialize исключить isLoading из сохранения

### 6.3 API сервис

- [ ] Создать `mobile/services/api.ts`. Что описать:
  - Supabase клиент через createClient с EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY
  - Axios инстанс с baseURL из EXPO_PUBLIC_API_URL
  - Axios request interceptor: перед каждым запросом получать session из Supabase, добавлять Authorization: Bearer {access_token}
  - Типизированные функции для каждого API эндпоинта: dumpText, dumpVoice, getTodayTasks, getAllTasks, updateTask, deleteTask, searchMemory

### 6.4 Константы сфер

- [ ] Создать `mobile/constants/spheres.ts` — массив объектов с полями: id (work/family/study/health/travel), label (на русском), icon (emoji или иконка), color (hex). Экспортировать типы Sphere и SphereInfo.

---

## Task 7: Root Layout + Auth Guard

Создаёт корневой layout приложения с авторизацией и инициализацией RevenueCat.

- [ ] Создать `mobile/app/_layout.tsx`. Что делает:
  - При монтировании вызвать initRevenueCat() из purchases.ts
  - Подписаться на Supabase auth state (onAuthStateChange): при SIGNED_IN загрузить профиль и задачи, при SIGNED_OUT очистить стор
  - Если пользователь не аутентифицирован — редирект на (onboarding)/welcome
  - Если аутентифицирован, но не онбордирован (isOnboarded=false) — редирект на (onboarding)/first-dump
  - Иначе — показать (app) стек
  - Stack навигация без заголовков для (app) группы

- [ ] Создать `mobile/services/purchases.ts`. Что описать:
  - Функция initRevenueCat(): инициализировать Purchases SDK с ключом из EXPO_PUBLIC_REVENUECAT_IOS_KEY / ANDROID_KEY в зависимости от платформы
  - Функция isPremium(): проверить entitlements, вернуть boolean
  - Функция buyPremium(): открыть paywall, обработать покупку

---

## Task 8: Audio Service + компоненты

Создаёт хук для записи голоса и UI-компоненты.

### 8.1 Audio сервис

- [ ] Создать `mobile/services/audio.ts`. Что описать:
  - Хук useVoiceRecorder() — использует expo-audio SDK 53 API:
    - useAudioRecorder из expo-audio (НЕ Audio.Recording из expo-av)
    - RecordingPresets.HIGH_QUALITY для настроек
    - requestMicrophonePermissionsAsync() перед стартом
    - Состояние: isRecording (boolean), audioUri (string | null), error (string | null)
    - Методы: startRecording, stopRecording
    - startRecording: запросить разрешение, создать recorder с HIGH_QUALITY, вызвать record()
    - stopRecording: вызвать stop(), получить uri, обновить состояние
    - Вернуть { isRecording, audioUri, error, startRecording, stopRecording }

### 8.2 UI компоненты

- [ ] Создать `mobile/components/TaskCard.tsx` — карточка задачи. Показывает: title, sphere (цвет из spheres.ts), priority (иконка или цвет), deadline (если есть), кнопку ✓ для отметки is_done. При нажатии ✓ вызывает updateTask через апи и обновляет стор.

- [ ] Создать `mobile/components/VoiceWave.tsx` — анимация во время записи голоса. Пульсирующие волны вокруг иконки микрофона. Принимает isRecording: boolean.

- [ ] Создать `mobile/components/SphereTab.tsx` — таб для одной сферы жизни. Показывает иконку, label, количество задач. Принимает sphere, isActive, onPress.

- [ ] Создать `mobile/components/DumpButton.tsx` — плавающая кнопка-микрофон (FAB). Показывает иконку микрофона. При нажатии навигирует на /dump.

---

## Task 9: Onboarding Flow (4 экрана)

Создаёт онбординг: приветствие → настройка профиля → первый dump → вау-момент.

### 9.1 Welcome экран

- [ ] Создать `mobile/app/(onboarding)/welcome.tsx`. Что показывает:
  - Логотип / иллюстрация
  - Заголовок "Привет, я твой Второй Мозг"
  - Подзаголовок с объяснением концепции (1-2 предложения)
  - Кнопка "Начать" → переход на setup.tsx
  - Кнопка "Войти" (если уже есть аккаунт) → Supabase Auth UI

### 9.2 Setup экран

- [ ] Создать `mobile/app/(onboarding)/setup.tsx`. Три шага через один экран (состояние step):
  - Шаг 1 — имя: текстовое поле
  - Шаг 2 — роль: 5 кнопок-чипов (мама/фрилансер/студент/предприниматель/другое)
  - Шаг 3 — пик активности: 3 кнопки (утро/день/вечер)
  - Кнопка "Далее" переходит к следующему шагу, на последнем шаге — переход на first-dump.tsx
  - Данные сохраняются в стор, при переходе на first-dump отправляются POST /auth/profile

### 9.3 First Dump + Вау-момент

- [ ] Создать `mobile/app/(onboarding)/first-dump.tsx`. Семь шагов (состояние step):
  - Шаг 1 — инструкция: "Нажми на микрофон и расскажи всё что у тебя на уме"
  - Шаг 2 — запись голоса: кнопка микрофона, VoiceWave анимация, кнопка "Стоп"
  - Шаг 3 — обработка: спиннер, текст "AI разбирает твои мысли..."
  - Шаги 4-6 — вау-момент: поочерёдно показываем каждую из today_top3 задач с анимацией появления (slide-in)
  - Шаг 7 — завершение: "Отлично! Твой второй мозг готов" + кнопка "Поехали" → setOnboarded(true) → навигация на (app)/index
  - После записи вызвать POST /dump/voice, получить today_top3 (массив объектов Task, НЕ индексы), сохранить в стор через setTodayTasks

---

## Task 10: Основные экраны приложения

Создаёт 5 главных экранов приложения.

### 10.1 Home "Сегодня"

- [ ] Создать `mobile/app/(app)/index.tsx`. Что показывает:
  - Приветствие с именем пользователя и датой
  - Секция "На сегодня" — TopTask список (до 3 задач из todayTasks в сторе)
  - Если задач нет — пустой стейт с подсказкой "Сделай дамп чтобы добавить задачи"
  - FAB кнопка DumpButton в правом нижнем углу
  - При монтировании: вызвать GET /tasks/today, обновить todayTasks в сторе

### 10.2 Dump экран

- [ ] Создать `mobile/app/(app)/dump.tsx`. Что описывает:
  - Использует хук useVoiceRecorder из audio.ts
  - Два режима: голос и текст (переключатель в UI)
  - Голосовой режим: кнопка микрофона (большая, по центру), VoiceWave анимация, кнопка стоп. После записи — автоматически отправить на POST /dump/voice
  - Текстовый режим: TextInput, кнопка "Отправить" → POST /dump/text
  - Обработка ошибок: показывать Alert при ошибке API
  - При успехе: navigate на /result с данными ответа

### 10.3 Result экран

- [ ] Создать `mobile/app/(app)/result.tsx`. Что показывает:
  - Получает данные через navigation params или query
  - Если был голосовой дамп — показывает транскрипцию вверху
  - Табы по сферам (SphereTab компонент) — только для сфер у которых есть задачи
  - Задачи в выбранном табе — список TaskCard
  - Кнопка "Готово" → навигация на Home

### 10.4 All Tasks экран

- [ ] Создать `mobile/app/(app)/all.tsx`. Что показывает:
  - Горизонтальный скролл с табами по сферам (+ таб "Все")
  - Список задач по выбранной сфере из allTasks в сторе
  - Pull-to-refresh: вызвать GET /tasks/, обновить стор
  - TaskCard компонент для каждой задачи

### 10.5 Task Detail экран

- [ ] Создать `mobile/app/(app)/task/[id].tsx`. Что показывает:
  - Полные данные задачи: title, notes, sphere, priority, deadline, reminder_at
  - Кнопка "Отметить выполненной" (PATCH is_done=true)
  - Кнопка редактирования title и notes
  - Кнопка выбора дедлайна (DateTimePicker)
  - Кнопка удаления с подтверждением

### 10.6 Profile экран

- [ ] Создать `mobile/app/(app)/profile.tsx`. Что показывает:
  - Имя, аватар (инициалы если нет фото)
  - Статус подписки (Free / Premium) через isPremium()
  - Кнопка "Улучшить до Premium" → buyPremium() если не премиум
  - Раздел "Память AI" — последние записи из GET /memory/profile
  - Статистика: всего задач, выполнено, процент
  - Кнопка выхода из аккаунта (Supabase signOut, очистка стора)

---

## Task 11: Push-уведомления (напоминания)

Создаёт систему напоминаний для задач через expo-notifications.

- [ ] Запросить разрешение на уведомления при входе в профиль или при первом напоминании.

- [ ] Создать функцию scheduleReminder(task: Task): планирует локальное уведомление через expo-notifications на время reminder_at задачи. Содержимое: title задачи, тело "Напоминание о задаче".

- [ ] В Task Detail экране: при выборе reminder_at вызывать scheduleReminder, при очистке — отменять уведомление.

- [ ] Добавить обработчик Notifications.addNotificationResponseReceivedListener в _layout.tsx: при тапе на уведомление — переходить на /task/[id].

- [ ] Commit: "feat: local push reminders via expo-notifications"

---

## Task 12: RevenueCat + Paywall

Настраивает монетизацию через RevenueCat.

- [ ] В RevenueCat dashboard создать продукты: monthly_premium ($4.99/мес), annual_premium ($29.99/год).

- [ ] Создать Offering "default" с двумя Package: monthly и annual.

- [ ] В `mobile/services/purchases.ts` реализовать:
  - initRevenueCat(userId?): инициализировать с платформенным ключом, если есть userId — вызвать logIn
  - isPremium(): получить CustomerInfo, вернуть наличие entitlement "premium"
  - buyPremium(): открыть стандартный RevenueCat paywall или вызвать purchasePackage, обработать ошибки (USER_CANCELLED — не показывать как ошибку)
  - restorePurchases(): восстановить покупки, обновить стор

- [ ] В profile.tsx показывать кнопку "Upgrade" и вызывать buyPremium(). При успехе — обновить UI.

- [ ] Commit: "feat: RevenueCat paywall integration"

---

## Task 13: Деплой на Railway

Разворачивает бэкенд на Railway, настраивает переменные окружения.

### 13.1 Dockerfile

- [ ] Создать `backend/Dockerfile`:
  - Базовый образ python:3.12-slim
  - Скопировать requirements.txt, установить зависимости
  - Скопировать исходники
  - CMD: uvicorn main:app --host 0.0.0.0 --port $PORT

### 13.2 Railway переменные окружения

- [ ] Создать `/.env.railway` — шаблон без секретов (все значения пустые). Переменные:
  - SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET
  - OPENAI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY
  - REDIS_URL (Railway Redis сервис URL)
  - ENVIRONMENT=production
  - ALLOWED_ORIGINS (URL Expo Web / домен фронтенда)

- [ ] **Важно** — чего НЕ делать при заполнении Railway Variables:
  - Не копировать локальные пути (например /Users/...) — они не существуют в контейнере
  - Не оставлять REDIS_URL=localhost — использовать внутренний Railway URL
  - Не добавлять пустые строки для опциональных переменных

### 13.3 Деплой

- [ ] Создать Railway проект, подключить GitHub репозиторий.

- [ ] Добавить Railway Redis сервис, скопировать REDIS_URL в переменные.

- [ ] Заполнить все переменные из .env.railway в Railway Variables.

- [ ] Задеплоить, проверить GET /health на Railway URL → `{"status": "ok"}`.

- [ ] Обновить EXPO_PUBLIC_API_URL в мобильном приложении на Railway URL.

- [ ] Commit: "feat: Railway deployment + Dockerfile"

---

## Порядок реализации

1. Task 1 — база (Supabase схема + FastAPI)
2. Task 2 — STT (Whisper)
3. Task 3 — AI Router + Parser
4. Task 4 — Dump API + Tasks CRUD + Auth
5. Task 5 — Memory (pgvector)
6. Task 6 — Mobile scaffold (Expo + Zustand + API сервис)
7. Task 7 — Root layout + Auth guard
8. Task 8 — Audio хук + компоненты
9. Task 9 — Онбординг (3 экрана)
10. Task 10 — Основные экраны (5 экранов)
11. Task 11 — Push-уведомления
12. Task 12 — RevenueCat
13. Task 13 — Деплой Railway

---

## Definition of Done для MVP

- Пользователь может зарегистрироваться через Supabase Auth
- Пользователь проходит онбординг из 7 шагов (настройка профиля + первый дамп)
- Голосовой дамп: запись → транскрипция Whisper → парсинг LLM → список задач
- Текстовый дамп: ввод → парсинг LLM → список задач
- Задачи сохраняются в Supabase с привязкой к пользователю
- Экран "Сегодня" показывает топ 3 задачи на день
- Все 5 экранов рабочие: Home, Dump, Result, All Tasks, Profile
- JWT аутентификация на все API эндпоинты
- Семантическая память сохраняется и доступна через API
- Push-напоминания работают
- RevenueCat paywall открывается и обрабатывает покупку
- Бэкенд задеплоен на Railway и отвечает на /health
