import pytest
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport
import auth

TEST_USER_ID = "test-user-uuid-1234"

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client(monkeypatch):
    monkeypatch.setattr(auth, "get_current_user_id", AsyncMock(return_value=TEST_USER_ID))
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.fixture
def test_user_id():
    return TEST_USER_ID
