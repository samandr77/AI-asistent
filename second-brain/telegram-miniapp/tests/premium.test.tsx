import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PremiumScreen } from "../src/screens/premium/PremiumScreen";
import { getPremiumStatus } from "../src/services/api";
import {
  openTelegramInvoice,
  refreshPremiumAfterTelegramPayment,
  requestPremiumInvoice,
} from "../src/services/payments";

vi.mock("../src/services/api", async () => {
  const actual = await vi.importActual<typeof import("../src/services/api")>(
    "../src/services/api",
  );
  return {
    ...actual,
    getPremiumStatus: vi.fn(),
  };
});

vi.mock("../src/services/payments", () => ({
  openTelegramInvoice: vi.fn(),
  refreshPremiumAfterTelegramPayment: vi.fn(),
  requestPremiumInvoice: vi.fn(),
}));

const mockedGetPremiumStatus = vi.mocked(getPremiumStatus);
const mockedOpenTelegramInvoice = vi.mocked(openTelegramInvoice);
const mockedRefreshPremiumAfterTelegramPayment = vi.mocked(
  refreshPremiumAfterTelegramPayment,
);
const mockedRequestPremiumInvoice = vi.mocked(requestPremiumInvoice);

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PremiumScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PremiumScreen", () => {
  beforeEach(() => {
    mockedGetPremiumStatus.mockReset();
    mockedOpenTelegramInvoice.mockReset();
    mockedRefreshPremiumAfterTelegramPayment.mockReset();
    mockedRequestPremiumInvoice.mockReset();
  });

  it("opens a Stars invoice and refreshes premium after paid status", async () => {
    mockedGetPremiumStatus.mockResolvedValue({
      is_premium: false,
      entitlement_id: null,
      expires_at: null,
      period_type: null,
      store: null,
      cancelled: false,
    });
    mockedRequestPremiumInvoice.mockResolvedValue({
      invoice_link: "https://t.me/$invoice/test",
      payload: "premium_monthly:test:nonce:sig",
    });
    mockedOpenTelegramInvoice.mockResolvedValue("paid");
    mockedRefreshPremiumAfterTelegramPayment.mockResolvedValue({
      is_premium: true,
      entitlement_id: "premium",
      expires_at: "2026-06-01T00:00:00Z",
      period_type: "normal",
      store: "telegram_stars",
      cancelled: false,
    });

    renderWithProviders();

    fireEvent.click(await screen.findByRole("button", { name: /buy|купить/i }));

    await waitFor(() => {
      expect(mockedRequestPremiumInvoice).toHaveBeenCalledOnce();
      expect(mockedOpenTelegramInvoice).toHaveBeenCalledWith(
        "https://t.me/$invoice/test",
      );
      expect(mockedRefreshPremiumAfterTelegramPayment).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText(/premium is active|premium активен/i)).toBeInTheDocument();
  });
});
