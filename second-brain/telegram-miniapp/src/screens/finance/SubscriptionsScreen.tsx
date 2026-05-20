import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import {
  detectFinanceSubscriptions,
  listFinanceSubscriptions,
} from "../../services/api";
import { SubscriptionSheet } from "./components/forms";
import type { FinanceSubscription } from "../../types/api";
import { Icon, type IconName } from "./components/Icon";
import {
  Alert,
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  SectionTitle,
  Skeleton,
  categoryLabel,
  centsToRub,
  fmt,
} from "./components/shell";

function subscriptionIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (
    n.includes("net") ||
    n.includes("okko") ||
    n.includes("кино") ||
    n.includes("spotify") ||
    n.includes("music")
  )
    return "film";
  if (n.includes("gpt") || n.includes("ai") || n.includes("claude"))
    return "sparkles";
  if (n.includes("icloud") || n.includes("storage") || n.includes("drive"))
    return "cpu";
  if (n.includes("notion") || n.includes("workspace")) return "briefcase";
  return "cpu";
}

function daysUntil(date: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays < 0) return "просрочено";
  if (diffDays === 0) return "сегодня";
  if (diffDays === 1) return "завтра";
  if (diffDays < 7) return `через ${diffDays} дн.`;
  if (diffDays < 30) return `через ${Math.round(diffDays / 7)} нед.`;
  return target.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function SubscriptionsScreen(): ReactNode {
  const [sheetOpen, setSheetOpen] = useState(false);
  const subscriptionsQuery = useQuery({
    queryKey: ["finance", "subscriptions"],
    queryFn: listFinanceSubscriptions,
  });
  const detectionQuery = useQuery({
    queryKey: ["finance", "subscriptions", "detection"],
    queryFn: detectFinanceSubscriptions,
  });

  const subscriptions = subscriptionsQuery.data ?? [];
  const detections = detectionQuery.data ?? [];

  const active = subscriptions.filter((s) => s.is_active);
  const monthlyTotal = active.reduce(
    (sum, s) => sum + centsToRub(s.amount_cents),
    0,
  );
  const yearlyTotal = monthlyTotal * 12;

  // sort by upcoming charge date
  const sorted: FinanceSubscription[] = [...active].sort((a, b) =>
    a.next_charge_date < b.next_charge_date ? -1 : 1,
  );

  const isLoading = subscriptionsQuery.isLoading;
  const hasError =
    subscriptionsQuery.isError &&
    !subscriptionsQuery.data &&
    !subscriptionsQuery.isFetching;

  return (
    <FinancePhone title="Подписки" activeTab="more" backTo="/finance/more">
      <div className="red-head">
        <div className="row between">
          <div className="hello">
            {active.length > 0
              ? `Найдено ${active.length} активных`
              : "Подписки"}
          </div>
          {detections.length > 0 ? (
            <Pill>
              <Icon name="sparkles" size={10} stroke="white" /> ИИ нашёл{" "}
              {detections.length} новых
            </Pill>
          ) : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            В месяц
          </div>
          <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={180} height={36} />
            ) : (
              fmt(monthlyTotal) + " ₽"
            )}
          </div>
          <div className="sub">
            {isLoading ? "Загружаю подписки…" : `${fmt(yearlyTotal)} ₽ в год`}
          </div>
        </div>
      </div>

      <div className="scroll">
        {detections.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <Alert
              tone="info"
              iconBg="blue-soft"
              icon="sparkles"
              title={`ИИ нашёл ${detections.length} повторяющихся платежа`}
              description={detections
                .slice(0, 2)
                .map(
                  (d) =>
                    `«${d.merchant}» ${fmt(centsToRub(d.amount_cents))} ₽/мес`,
                )
                .join(", ")}
              trailing={
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: "8px 12px", fontSize: 12 }}
                >
                  Да
                </button>
              }
            />
          </div>
        ) : null}

        <SectionTitle
          title="Ближайшие списания"
          action={sorted.length > 1 ? { label: "сортировка" } : undefined}
          style={{ margin: "4px 4px 10px" }}
        />

        {hasError ? (
          <ErrorState
            onRetry={() => void subscriptionsQuery.refetch()}
            message="Не удалось загрузить подписки"
          />
        ) : isLoading ? (
          <>
            <Skeleton height={64} />
            <div style={{ height: 10 }} />
            <Skeleton height={64} />
            <div style={{ height: 10 }} />
            <Skeleton height={64} />
          </>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="refresh"
            title="Подписок пока нет"
            description="Добавьте подписку или подключите банк — ИИ найдёт повторяющиеся платежи."
          />
        ) : (
          sorted.map((s) => (
            <div className="sub-row" key={s.id}>
              <div className="ico big red-soft">
                <Icon name={subscriptionIcon(s.name)} size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{s.name}</div>
                <div className="tiny mute">
                  {categoryLabel(s.category)} · {s.currency}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ fontWeight: 800 }}>
                  {fmt(centsToRub(s.amount_cents))} ₽
                </div>
                <div className="tiny mute">{daysUntil(s.next_charge_date)}</div>
              </div>
            </div>
          ))
        )}

        <div style={{ height: 12 }} />
        <button
          type="button"
          className="btn full ghost"
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="plus" size={14} /> Добавить подписку
        </button>
        <div style={{ height: 16 }} />
      </div>
      <SubscriptionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </FinancePhone>
  );
}
