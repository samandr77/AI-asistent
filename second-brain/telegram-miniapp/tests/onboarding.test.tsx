import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SetupScreen } from "../src/screens/onboarding/SetupScreen";
import { updateProfile } from "../src/services/api";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    updateProfile: vi.fn(),
  };
});

const mockedUpdateProfile = vi.mocked(updateProfile);

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SetupScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SetupScreen", () => {
  beforeEach(() => {
    mockedUpdateProfile.mockReset();
    mockedUpdateProfile.mockResolvedValue({
      id: "user-1",
      language: "ru",
      is_onboarded: true,
    });
  });

  it("walks through the interactive onboarding analysis", async () => {
    renderWithProviders();

    expect(screen.getByText("Твой личный центр управления")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Начать" }));
    expect(screen.getByText("Что это за приложение")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Как оно работает")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Попробуй сам")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Анализ" }));
    expect(await screen.findByText("Записать расход, подписку или финансовое событие.")).toBeInTheDocument();
    expect(await screen.findByText("Создать действие и поставить его в план дня.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.click(screen.getByRole("button", { name: "Начать пользоваться" }));

    await waitFor(() => expect(mockedUpdateProfile).toHaveBeenCalled());
  });
});
