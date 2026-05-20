import { AxiosError } from "axios";

import { api } from "../services/api";
import { isOnboardingComplete } from "../services/onboarding";
import type {
  AccountPendingDeletionResponse,
  TelegramSessionResponse,
} from "../types/api";
import { getTelegramInitData, getTelegramStartParam } from "./sdk";

export class AccountPendingDeletionError extends Error {
  scheduledFor: string;

  constructor(scheduledFor: string) {
    super("Account pending deletion");
    this.name = "AccountPendingDeletionError";
    this.scheduledFor = scheduledFor;
  }
}

export async function createDevSession(): Promise<TelegramSessionResponse> {
  const { data } = await api.post<TelegramSessionResponse>(
    "/telegram/auth/dev-session",
  );
  return data;
}

export async function createTelegramSession(
  initData = getTelegramInitData(),
  startParam = getTelegramStartParam(),
): Promise<TelegramSessionResponse> {
  try {
    const { data } = await api.post<TelegramSessionResponse>(
      "/telegram/auth/session",
      {
        init_data: initData,
        start_param: startParam,
      },
    );
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<AccountPendingDeletionResponse>;
    if (
      axiosError.response?.status === 410 &&
      axiosError.response.data?.error === "account_pending_deletion"
    ) {
      throw new AccountPendingDeletionError(
        axiosError.response.data.scheduled_for,
      );
    }
    throw error;
  }
}

export function routeAfterTelegramSession(
  session: TelegramSessionResponse,
): string {
  if (session.user.deleted_at) {
    return "/account/pending-deletion";
  }
  if (
    session.is_new_user ||
    !session.user.is_onboarded ||
    !isOnboardingComplete()
  ) {
    return "/onboarding/setup";
  }
  return "/today";
}
