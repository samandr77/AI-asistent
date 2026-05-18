import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountPendingDeletionScreen } from "../src/screens/account/AccountPendingDeletionScreen";
import { ProfileScreen } from "../src/screens/profile/ProfileScreen";
import { SupportScreen } from "../src/screens/support/SupportScreen";
import {
  deleteAccount,
  getMemoryProfile,
  getMe,
  getPremiumStatus,
  updateProfile,
} from "../src/services/api";
import { useSessionStore } from "../src/store/useSessionStore";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    deleteAccount: vi.fn(),
    getMemoryProfile: vi.fn(),
    getMe: vi.fn(),
    getPremiumStatus: vi.fn(),
    updateProfile: vi.fn(),
  };
});

const mockedDeleteAccount = vi.mocked(deleteAccount);
const mockedGetMemoryProfile = vi.mocked(getMemoryProfile);
const mockedGetMe = vi.mocked(getMe);
const mockedGetPremiumStatus = vi.mocked(getPremiumStatus);
const mockedUpdateProfile = vi.mocked(updateProfile);

function renderWithProviders(element = <ProfileScreen />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {element}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    mockedDeleteAccount.mockReset();
    mockedGetMemoryProfile.mockReset();
    mockedGetMe.mockReset();
    mockedGetPremiumStatus.mockReset();
    mockedUpdateProfile.mockReset();
    useSessionStore.getState().setSession("token", {
      id: "00000000-0000-4000-8000-000000000501",
      telegram_user_id: 1001,
      provider: "telegram",
      name: "Alex",
      username: "alex",
    });
  });

  it("renders Telegram profile, saves language, and schedules deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedGetMe.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000501",
      provider: "telegram",
      profile: {
        id: "00000000-0000-4000-8000-000000000501",
        name: "Alex Profile",
        language: "en",
      },
    });
    mockedGetPremiumStatus.mockResolvedValue({
      is_premium: false,
      entitlement_id: null,
      expires_at: null,
      period_type: null,
      store: null,
      cancelled: false,
    });
    mockedGetMemoryProfile.mockResolvedValue([
      {
        id: "memory-1",
        content: "Prefers morning planning",
      },
    ]);
    mockedUpdateProfile.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000501",
      language: "ru",
    });
    mockedDeleteAccount.mockResolvedValue({
      status: "scheduled",
      scheduled_for: "2026-06-01T00:00:00Z",
    });

    renderWithProviders();

    expect(await screen.findByText("Alex Profile")).toBeInTheDocument();
    expect(await screen.findByText("Prefers morning planning")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "RU" }));
    await waitFor(() => {
      expect(mockedUpdateProfile).toHaveBeenCalledWith({ language: "ru" });
    });

    fireEvent.click(screen.getByRole("button", { name: /delete account|удалить/i }));
    await waitFor(() => {
      expect(mockedDeleteAccount).toHaveBeenCalledOnce();
    });
  });

  it("renders support links", () => {
    renderWithProviders(<SupportScreen />);

    expect(screen.getByText("support@second-brain.app")).toBeInTheDocument();
    expect(screen.getAllByText(/privacy|policy/i).length).toBeGreaterThan(0);
  });

  it("renders account pending deletion date", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/account/pending-deletion",
            state: { scheduled_for: "2026-06-01T00:00:00Z" },
          },
        ]}
      >
        <AccountPendingDeletionScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText(/2026|01|1/)).toBeInTheDocument();
  });
});
