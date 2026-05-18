import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getPremiumStatus } from "../../services/api";
import {
  openTelegramInvoice,
  refreshPremiumAfterTelegramPayment,
  requestPremiumInvoice,
} from "../../services/payments";

export function PremiumScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const premiumQuery = useQuery({
    queryKey: ["premium-status"],
    queryFn: getPremiumStatus,
  });
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const invoice = await requestPremiumInvoice();
      const status = await openTelegramInvoice(invoice.invoice_link);
      if (status === "paid") {
        return refreshPremiumAfterTelegramPayment();
      }
      return premiumQuery.data ?? getPremiumStatus();
    },
    onSuccess: (status) => {
      queryClient.setQueryData(["premium-status"], status);
    },
  });
  const refreshMutation = useMutation({
    mutationFn: refreshPremiumAfterTelegramPayment,
    onSuccess: (status) => {
      queryClient.setQueryData(["premium-status"], status);
    },
  });
  const premium = checkoutMutation.data ?? refreshMutation.data ?? premiumQuery.data;
  const isPremium = Boolean(premium?.is_premium);

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.premium")}</h1>
        <div className="status">
          <strong>
            {isPremium ? t("premium.activeTitle") : t("premium.freeTitle")}
          </strong>
          <p className="muted">
            {isPremium
              ? t("premium.activeDescription", {
                  expires: premium?.expires_at
                    ? new Date(premium.expires_at).toLocaleDateString()
                    : t("premium.noExpiry"),
                })
              : t("premium.freeDescription")}
          </p>
        </div>
        <div className="benefit-list">
          <span>{t("premium.benefitDumps")}</span>
          <span>{t("premium.benefitGoals")}</span>
          <span>{t("premium.benefitHistory")}</span>
          <span>{t("premium.benefitAi")}</span>
        </div>
        {checkoutMutation.error ? (
          <p className="error-text">{t("premium.checkoutError")}</p>
        ) : null}
        <div className="action-row">
          <button
            className="button"
            disabled={checkoutMutation.isPending || isPremium}
            type="button"
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending
              ? t("common.loading")
              : t("premium.buyStars")}
          </button>
          <button
            className="button secondary"
            disabled={refreshMutation.isPending}
            type="button"
            onClick={() => refreshMutation.mutate()}
          >
            {refreshMutation.isPending ? t("common.loading") : t("premium.refresh")}
          </button>
        </div>
      </section>
    </main>
  );
}
