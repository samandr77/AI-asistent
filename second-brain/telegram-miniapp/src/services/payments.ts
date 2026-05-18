import {
  createTelegramInvoice,
  refreshTelegramPremium,
} from "./api";
import { getTelegramWebApp } from "../telegram/sdk";
import type { PremiumStatus, TelegramInvoiceResponse } from "../types/api";

export async function requestPremiumInvoice(): Promise<TelegramInvoiceResponse> {
  return createTelegramInvoice({ plan_id: "premium_monthly" });
}

export async function openTelegramInvoice(invoiceLink: string): Promise<string> {
  const webApp = getTelegramWebApp();
  if (!webApp?.openInvoice) {
    window.location.assign(invoiceLink);
    return "external";
  }

  return new Promise((resolve) => {
    webApp.openInvoice?.(invoiceLink, (status) => resolve(status));
  });
}

export async function refreshPremiumAfterTelegramPayment(): Promise<PremiumStatus> {
  return refreshTelegramPremium();
}
