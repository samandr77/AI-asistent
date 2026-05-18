from __future__ import annotations

from typing import Any

import httpx

from config import settings


class TelegramBotError(RuntimeError):
    pass


class TelegramBotClient:
    def __init__(self, token: str | None = None):
        self.token = token if token is not None else settings.telegram_bot_token
        if not self.token:
            raise TelegramBotError("TELEGRAM_BOT_TOKEN is not configured")
        self.base_url = f"https://api.telegram.org/bot{self.token}"

    async def _post(self, method: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(f"{self.base_url}/{method}", json=payload)
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            raise TelegramBotError(data.get("description") or method)
        return data["result"]

    async def send_message(
        self,
        chat_id: int,
        text: str,
        *,
        reply_markup: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return await self._post("sendMessage", payload)

    async def get_file(self, file_id: str) -> dict[str, Any]:
        return await self._post("getFile", {"file_id": file_id})

    async def download_file(self, file_path: str) -> bytes:
        url = f"https://api.telegram.org/file/bot{self.token}/{file_path}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
        response.raise_for_status()
        return response.content

    async def answer_pre_checkout_query(
        self,
        pre_checkout_query_id: str,
        *,
        ok: bool,
        error_message: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "pre_checkout_query_id": pre_checkout_query_id,
            "ok": ok,
        }
        if error_message:
            payload["error_message"] = error_message
        return await self._post("answerPreCheckoutQuery", payload)

    async def create_invoice_link(
        self,
        *,
        title: str,
        description: str,
        payload: str,
        currency: str,
        prices: list[dict[str, Any]],
        provider_token: str | None = None,
        subscription_period: int | None = None,
    ) -> str:
        request_payload: dict[str, Any] = {
            "title": title,
            "description": description,
            "payload": payload,
            "currency": currency,
            "prices": prices,
        }
        if provider_token is not None:
            request_payload["provider_token"] = provider_token
        if subscription_period is not None:
            request_payload["subscription_period"] = subscription_period
        result = await self._post("createInvoiceLink", request_payload)
        return str(result)


def miniapp_keyboard(text: str = "Open Second Brain") -> dict[str, Any]:
    return {
        "inline_keyboard": [
            [
                {
                    "text": text,
                    "web_app": {"url": settings.telegram_miniapp_url},
                }
            ]
        ]
    }
