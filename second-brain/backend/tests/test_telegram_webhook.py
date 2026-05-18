from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

from models.task import ParsedDump, ParsedTask, Priority, Sphere
from models.telegram import TelegramSessionUser
from services.parser import ParsedDumpWithUsage
from services.telegram_users import TelegramBootstrapResult


pytestmark = pytest.mark.anyio

WEBHOOK_SECRET = "telegram-secret"


def _message_update(text: str = "Plan launch") -> dict:
    return {
        "update_id": 1,
        "message": {
            "message_id": 10,
            "from": {
                "id": 1001,
                "first_name": "Alex",
                "username": "alex",
            },
            "chat": {"id": 2002, "type": "private"},
            "text": text,
        },
    }


def _voice_update() -> dict:
    update = _message_update("")
    update["message"].pop("text", None)
    update["message"]["voice"] = {
        "file_id": "voice-file-id",
        "file_unique_id": "voice-unique-id",
        "duration": 12,
        "mime_type": "audio/ogg",
    }
    return update


def _refunded_payment_update() -> dict:
    update = _message_update("")
    update["message"].pop("text", None)
    update["message"]["refunded_payment"] = {
        "currency": "XTR",
        "total_amount": 499,
        "invoice_payload": "premium_monthly:test:nonce:sig",
        "telegram_payment_charge_id": "tg-charge-1",
    }
    return update


async def test_webhook_rejects_invalid_secret():
    from main import app

    with patch("api.telegram_webhook.settings") as mock_settings:
        mock_settings.telegram_webhook_secret = WEBHOOK_SECRET
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/telegram/webhook",
                headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
                json=_message_update(),
            )

    assert response.status_code == 401


async def test_start_command_replies_with_miniapp_button():
    from main import app

    bot = SimpleNamespace(send_message=AsyncMock())
    with patch("api.telegram_webhook.settings") as mock_settings:
        mock_settings.telegram_webhook_secret = WEBHOOK_SECRET
        with patch("api.telegram_webhook.TelegramBotClient", return_value=bot):
            with patch("api.telegram_webhook.miniapp_keyboard", return_value={}):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                ) as client:
                    response = await client.post(
                        "/telegram/webhook",
                        headers={"X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET},
                        json=_message_update("/start"),
                    )

    assert response.status_code == 200
    bot.send_message.assert_awaited()


@pytest.mark.parametrize(
    ("command", "expected_text"),
    [
        ("/help", "thought dump"),
        ("/settings", "Open Second Brain"),
        ("/premium", "Open Second Brain"),
        ("/paysupport", "Telegram Stars payment support"),
        ("/deleteaccount", "Open Second Brain"),
    ],
)
async def test_known_commands_reply(command: str, expected_text: str):
    from main import app

    bot = SimpleNamespace(send_message=AsyncMock())
    with patch("api.telegram_webhook.settings") as mock_settings:
        mock_settings.telegram_webhook_secret = WEBHOOK_SECRET
        with patch("api.telegram_webhook.TelegramBotClient", return_value=bot):
            with patch("api.telegram_webhook.miniapp_keyboard", return_value={}):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                ) as client:
                    response = await client.post(
                        "/telegram/webhook",
                        headers={"X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET},
                        json=_message_update(command),
                    )

    assert response.status_code == 200
    assert expected_text in bot.send_message.await_args.args[1]


async def test_text_message_runs_dump_flow():
    from main import app

    bot = SimpleNamespace(send_message=AsyncMock())
    bootstrap = TelegramBootstrapResult(
        user=TelegramSessionUser(
            id=UUID("00000000-0000-4000-8000-000000000001"),
            telegram_user_id=1001,
            username="alex",
        ),
        profile=None,
        is_new_user=False,
    )
    parsed = ParsedDump(
        tasks=[
            ParsedTask(
                title="Plan launch",
                sphere=Sphere.work,
                priority=Priority.high,
                is_today=True,
            )
        ]
    )
    parsed_with_usage = ParsedDumpWithUsage(parsed=parsed, tokens=42)

    with patch("api.telegram_webhook.settings") as mock_settings:
        mock_settings.telegram_webhook_secret = WEBHOOK_SECRET
        with patch("api.telegram_webhook.TelegramBotClient", return_value=bot):
            with patch("api.telegram_webhook.miniapp_keyboard", return_value={}):
                with patch("api.telegram_webhook.get_supabase", return_value=object()):
                    with patch(
                        "api.telegram_webhook.bootstrap_telegram_user",
                        return_value=bootstrap,
                    ):
                        with patch(
                            "api.telegram_webhook._enforce_dump_limit",
                            new=AsyncMock(return_value=SimpleNamespace(is_premium=True)),
                        ):
                            with patch(
                                "api.telegram_webhook._enforce_ai_budget",
                                new=AsyncMock(),
                            ):
                                with patch(
                                    "api.telegram_webhook.get_ai_tier_policy",
                                    return_value=["cheap"],
                                ):
                                    with patch(
                                        "api.telegram_webhook.parse_dump",
                                        new=AsyncMock(return_value=parsed_with_usage),
                                    ):
                                        with patch(
                                            "api.telegram_webhook.save_tasks",
                                            new=AsyncMock(
                                                return_value=("dump-1", ["task-1"])
                                            ),
                                        ):
                                            async with AsyncClient(
                                                transport=ASGITransport(app=app),
                                                base_url="http://test",
                                            ) as client:
                                                response = await client.post(
                                                    "/telegram/webhook",
                                                    headers={
                                                        "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET
                                                    },
                                                    json=_message_update(),
                                                )

    assert response.status_code == 200
    bot.send_message.assert_awaited()


async def test_voice_message_runs_dump_flow():
    from main import app

    bot = SimpleNamespace(
        send_message=AsyncMock(),
        get_file=AsyncMock(return_value={"file_path": "voice/file.ogg"}),
        download_file=AsyncMock(return_value=b"voice-bytes"),
    )
    bootstrap = TelegramBootstrapResult(
        user=TelegramSessionUser(
            id=UUID("00000000-0000-4000-8000-000000000001"),
            telegram_user_id=1001,
            username="alex",
        ),
        profile=None,
        is_new_user=False,
    )
    parsed = ParsedDump(
        tasks=[
            ParsedTask(
                title="Voice task",
                sphere=Sphere.work,
                priority=Priority.medium,
                is_today=False,
            )
        ]
    )
    parsed_with_usage = ParsedDumpWithUsage(parsed=parsed, tokens=42)

    with patch("api.telegram_webhook.settings") as mock_settings:
        mock_settings.telegram_webhook_secret = WEBHOOK_SECRET
        with patch("api.telegram_webhook.TelegramBotClient", return_value=bot):
            with patch("api.telegram_webhook.miniapp_keyboard", return_value={}):
                with patch("api.telegram_webhook.get_supabase", return_value=object()):
                    with patch(
                        "api.telegram_webhook.bootstrap_telegram_user",
                        return_value=bootstrap,
                    ):
                        with patch(
                            "api.telegram_webhook._enforce_dump_limit",
                            new=AsyncMock(return_value=SimpleNamespace(is_premium=True)),
                        ):
                            with patch(
                                "api.telegram_webhook._enforce_ai_budget",
                                new=AsyncMock(),
                            ):
                                with patch(
                                    "api.telegram_webhook.get_ai_tier_policy",
                                    return_value=["cheap"],
                                ):
                                    with patch(
                                        "api.telegram_webhook.transcribe_audio_with_fallback",
                                        new=AsyncMock(return_value="Voice transcript"),
                                    ):
                                        with patch(
                                            "api.telegram_webhook.parse_dump",
                                            new=AsyncMock(return_value=parsed_with_usage),
                                        ):
                                            with patch(
                                                "api.telegram_webhook.save_tasks",
                                                new=AsyncMock(
                                                    return_value=("dump-1", ["task-1"])
                                                ),
                                            ):
                                                async with AsyncClient(
                                                    transport=ASGITransport(app=app),
                                                    base_url="http://test",
                                                ) as client:
                                                    response = await client.post(
                                                        "/telegram/webhook",
                                                        headers={
                                                            "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET
                                                        },
                                                        json=_voice_update(),
                                                    )

    assert response.status_code == 200
    bot.get_file.assert_awaited_with("voice-file-id")
    bot.download_file.assert_awaited_with("voice/file.ogg")
    bot.send_message.assert_awaited()


async def test_refunded_payment_update_refreshes_premium_status():
    from main import app

    bot = SimpleNamespace(send_message=AsyncMock())
    with patch("api.telegram_webhook.settings") as mock_settings:
        mock_settings.telegram_webhook_secret = WEBHOOK_SECRET
        with patch("api.telegram_webhook.TelegramBotClient", return_value=bot):
            with patch("api.telegram_webhook.miniapp_keyboard", return_value={}):
                with patch("api.telegram_webhook.get_supabase", return_value=object()):
                    with patch("api.telegram_webhook.process_refunded_payment") as refund:
                        async with AsyncClient(
                            transport=ASGITransport(app=app),
                            base_url="http://test",
                        ) as client:
                            response = await client.post(
                                "/telegram/webhook",
                                headers={
                                    "X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET
                                },
                                json=_refunded_payment_update(),
                            )

    assert response.status_code == 200
    refund.assert_called_once()
    assert "refund received" in bot.send_message.await_args.args[1]
