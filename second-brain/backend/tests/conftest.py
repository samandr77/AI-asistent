import pytest
from httpx import AsyncClient, ASGITransport

TEST_USER_ID = "test-user-uuid-1234"

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client():
    from main import app
    import auth
    app.dependency_overrides[auth.get_current_user_id] = lambda: TEST_USER_ID
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def test_user_id():
    return TEST_USER_ID
