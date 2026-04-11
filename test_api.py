import os
import httpx
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
api_key  = os.getenv("ANTHROPIC_API_KEY")

resp = httpx.post(
    f"{base_url}/v1/messages",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    },
    json={
        "model": "claude-sonnet-4-6",
        "max_tokens": 50,
        "stream": False,
        "messages": [{"role": "user", "content": "Скажи только: API работает!"}],
    },
    timeout=15,
)

print(f"Статус: {resp.status_code}")
data = resp.json()
print(f"Модель: {data.get('model', '?')}")
if "content" in data:
    print(f"Ответ: {data['content'][0]['text']}")
else:
    print(f"Ответ: {data}")
