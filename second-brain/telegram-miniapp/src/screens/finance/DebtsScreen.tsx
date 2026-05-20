import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { listFinanceDebts } from "../../services/api";
import { DebtSheet } from "./components/forms";
import type { FinanceDebt } from "../../types/api";
import { Icon, type IconName } from "./components/Icon";
import {
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  Skeleton,
  centsToRub,
  fmt,
} from "./components/shell";

const DEBT_TYPE_LABEL: Record<FinanceDebt["type"], string> = {
  credit_card: "Кредитная карта",
  loan: "Кредит",
  mortgage: "Ипотека",
  installment: "Рассрочка",
  personal: "Личный долг",
  other: "Долг",
};

const DEBT_ICON: Record<FinanceDebt["type"], IconName> = {
  credit_card: "card",
  loan: "bank",
  mortgage: "house",
  installment: "cpu",
  personal: "tag",
  other: "tag",
};

function debtAccent(type: FinanceDebt["type"]): "red" | "dark" | "card" {
  if (type === "credit_card") return "red";
  if (type === "mortgage" || type === "loan") return "dark";
  return "card";
}

function nextPaymentLabel(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function avgRate(debts: FinanceDebt[]): number | null {
  const rated = debts.filter(
    (d) => typeof d.interest_rate_percent === "number",
  );
  if (rated.length === 0) return null;
  const sum = rated.reduce((acc, d) => acc + (d.interest_rate_percent ?? 0), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

export function DebtsScreen(): ReactNode {
  const [sheetOpen, setSheetOpen] = useState(false);
  const debtsQuery = useQuery({
    queryKey: ["finance", "debts"],
    queryFn: listFinanceDebts,
  });

  const debts = debtsQuery.data ?? [];
  const totalBalance = debts.reduce(
    (sum, d) => sum + centsToRub(d.balance_cents),
    0,
  );
  const totalMonthly = debts.reduce(
    (sum, d) => sum + centsToRub(d.monthly_payment_cents),
    0,
  );
  const rate = avgRate(debts);

  const isLoading = debtsQuery.isLoading;
  const hasError =
    debtsQuery.isError && !debtsQuery.data && !debtsQuery.isFetching;

  return (
    <FinancePhone
      title="Долги и кредиты"
      activeTab="more"
      backTo="/finance/more"
    >
      <div className="red-head">
        <div className="row between">
          <div className="hello">
            {debts.length > 0
              ? `${debts.length} действующих долга`
              : "Долги и кредиты"}
          </div>
          <Pill>Текущий период</Pill>
        </div>
        <div style={{ marginTop: 14 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            Общий остаток
          </div>
          <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={220} height={36} />
            ) : (
              fmt(totalBalance) + " ₽"
            )}
          </div>
          <div className="sub">
            {isLoading ? (
              "Загружаю долги…"
            ) : totalMonthly > 0 ? (
              <>
                Платёж в месяц <b className="num">{fmt(totalMonthly)} ₽</b>
                {rate !== null ? ` · в среднем ${rate}%` : ""}
              </>
            ) : (
              "Долгов пока нет"
            )}
          </div>
        </div>
      </div>

      <div className="scroll">
        {hasError ? (
          <ErrorState
            onRetry={() => void debtsQuery.refetch()}
            message="Не удалось загрузить долги"
          />
        ) : isLoading ? (
          <>
            <Skeleton height={150} />
            <div style={{ height: 12 }} />
            <Skeleton height={150} />
          </>
        ) : debts.length === 0 ? (
          <EmptyState
            icon="card"
            title="Долгов пока нет"
            description="Добавьте кредитку, ипотеку или рассрочку, чтобы видеть план погашения."
          />
        ) : (
          debts.map((d) => {
            const accent = debtAccent(d.type);
            const balance = centsToRub(d.balance_cents);
            const monthly = centsToRub(d.monthly_payment_cents);
            const rateStr =
              typeof d.interest_rate_percent === "number"
                ? `${d.interest_rate_percent}%`
                : "—";
            if (accent === "card") {
              return (
                <div
                  className="card big"
                  key={d.id}
                  style={{ marginBottom: 12 }}
                >
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <div className="row gap">
                      <div className="ico red-soft">
                        <Icon name={DEBT_ICON[d.type]} size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800 }}>{d.name}</div>
                        <div className="tiny mute">
                          {DEBT_TYPE_LABEL[d.type]}
                        </div>
                      </div>
                    </div>
                    <div className="num" style={{ fontWeight: 800 }}>
                      {fmt(balance)} ₽
                    </div>
                  </div>
                  <div className="tiny mute" style={{ marginTop: 8 }}>
                    Платёж {fmt(monthly)} ₽ · следующий{" "}
                    {nextPaymentLabel(d.next_payment_date)} · {rateStr}
                  </div>
                </div>
              );
            }
            return (
              <div
                className={`debt-card ${accent}`}
                key={d.id}
                style={{ marginBottom: 12 }}
              >
                <div className="row between">
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.8,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}
                    >
                      {DEBT_TYPE_LABEL[d.type]}
                    </div>
                    <div
                      style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}
                    >
                      {d.name}
                    </div>
                  </div>
                  <Icon name={DEBT_ICON[d.type]} size={26} stroke="white" />
                </div>
                <div
                  className="num"
                  style={{ fontSize: 28, fontWeight: 800, marginTop: 14 }}
                >
                  {fmt(balance)} ₽
                </div>
                <div className="meta-row">
                  <div>
                    <div className="lab">Ставка</div>
                    <div className="val">{rateStr}</div>
                  </div>
                  <div>
                    <div className="lab">Платёж</div>
                    <div className="val">{fmt(monthly)} ₽</div>
                  </div>
                  <div>
                    <div className="lab">Срок</div>
                    <div className="val">
                      {nextPaymentLabel(d.next_payment_date)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {debts.length > 1 ? (
          <div
            className="card big"
            style={{
              background: "var(--fin-cream-2)",
              boxShadow: "none",
            }}
          >
            <div className="row gap">
              <div className="ico red">
                <Icon name="trend-down" size={16} stroke="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  Стратегия снежного кома
                </div>
                <div className="tiny mute" style={{ marginTop: 2 }}>
                  Сначала закрывайте долг с самой высокой ставкой, потом
                  переключайтесь на следующий — освободитесь от долгов быстрее.
                </div>
              </div>
              <Icon name="chevron-right" size={16} stroke="var(--fin-mute)" />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="btn full ghost"
          style={{ marginTop: 12 }}
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="plus" size={14} /> Добавить долг
        </button>
        <div style={{ height: 16 }} />
      </div>
      <DebtSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </FinancePhone>
  );
}
