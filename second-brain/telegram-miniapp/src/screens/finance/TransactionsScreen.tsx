import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import {
  listFinanceAccounts,
  listFinanceTransactions,
} from "../../services/api";
import type { FinanceTransaction } from "../../types/api";
import { TransactionSheet } from "./components/forms";
import { Icon } from "./components/Icon";
import {
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  Skeleton,
  categoryIcon,
  categoryLabel,
  centsToRub,
  fmt,
} from "./components/shell";
import { TxRow } from "./FinanceScreen";

type ChipKey = "all" | "expense" | "income" | string;

const BASE_CHIPS: Array<{ key: ChipKey; label: string }> = [
  { key: "all", label: "Все" },
  { key: "expense", label: "Расходы" },
  { key: "income", label: "Доходы" },
];

function txIconBg(
  type: FinanceTransaction["type"],
): "red-soft" | "green-soft" | "amber-soft" {
  if (type === "income") return "green-soft";
  if (type === "transfer") return "amber-soft";
  return "red-soft";
}

function txAmount(transaction: FinanceTransaction): number {
  const rub = centsToRub(transaction.amount_cents);
  return transaction.type === "income" ? rub : -rub;
}

type DayGroup = {
  key: string;
  label: string;
  sum: number;
  items: FinanceTransaction[];
};

function dayLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const dateLabel = target.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  if (target.getTime() === today.getTime()) return `Сегодня · ${dateLabel}`;
  if (target.getTime() === yesterday.getTime()) return `Вчера · ${dateLabel}`;
  const weekday = target.toLocaleDateString("ru-RU", { weekday: "long" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${dateLabel}`;
}

function groupByDay(transactions: FinanceTransaction[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const tx of transactions) {
    const existing = map.get(tx.occurred_on);
    const amount = txAmount(tx);
    if (existing) {
      existing.items.push(tx);
      existing.sum += amount;
    } else {
      map.set(tx.occurred_on, {
        key: tx.occurred_on,
        label: dayLabel(tx.occurred_on),
        sum: amount,
        items: [tx],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

function formatDaySum(sum: number): string {
  if (sum >= 0) return "+" + fmt(sum) + " ₽";
  return "−" + fmt(Math.abs(sum)) + " ₽";
}

function txMeta(tx: FinanceTransaction): string {
  const time = new Date(tx.created_at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${categoryLabel(tx.category)} · ${time}`;
}

export function TransactionsScreen(): ReactNode {
  const [activeChip, setActiveChip] = useState<ChipKey>("all");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const transactionsQuery = useQuery({
    queryKey: ["finance", "transactions"],
    queryFn: () => listFinanceTransactions({ limit: 100 }),
  });
  const accountsQuery = useQuery({
    queryKey: ["finance", "accounts"],
    queryFn: listFinanceAccounts,
  });

  const transactions = transactionsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];

  const chips = useMemo(() => {
    const accountChips = accounts.slice(0, 3).map((a) => ({
      key: a.id,
      label: a.name,
    }));
    return [...BASE_CHIPS, ...accountChips];
  }, [accounts]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (activeChip === "expense" && tx.type !== "expense") return false;
      if (activeChip === "income" && tx.type !== "income") return false;
      if (
        activeChip !== "all" &&
        activeChip !== "expense" &&
        activeChip !== "income" &&
        tx.account_id !== activeChip
      ) {
        return false;
      }
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack =
          `${tx.merchant ?? ""} ${tx.category} ${tx.note ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, activeChip, query]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + centsToRub(t.amount_cents), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + centsToRub(t.amount_cents), 0);

  const isLoading = transactionsQuery.isLoading;
  const hasError =
    transactionsQuery.isError &&
    !transactionsQuery.data &&
    !transactionsQuery.isFetching;

  return (
    <FinancePhone title="Операции" activeTab="transactions" backTo="/finance">
      <div className="red-head" style={{ paddingBottom: 22 }}>
        <div className="row between">
          <div className="hello">
            {accounts.length > 0
              ? `Все счета · ${accounts.length}`
              : "Все счета"}
          </div>
          <Pill>
            Все время <Icon name="chevron-down" size={10} stroke="white" />
          </Pill>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div
              className="label"
              style={{ color: "rgba(255,255,255,.7)", fontSize: 9 }}
            >
              Расходы
            </div>
            <div className="num" style={{ fontSize: 24, fontWeight: 800 }}>
              {isLoading ? (
                <Skeleton width={120} height={26} />
              ) : (
                fmt(totalExpense) + " ₽"
              )}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              borderLeft: "1px solid rgba(255,255,255,.25)",
              paddingLeft: 12,
            }}
          >
            <div
              className="label"
              style={{ color: "rgba(255,255,255,.7)", fontSize: 9 }}
            >
              Доходы
            </div>
            <div
              className="num"
              style={{ fontSize: 24, fontWeight: 800, color: "#B4F0C8" }}
            >
              {isLoading ? (
                <Skeleton width={120} height={26} />
              ) : (
                "+" + fmt(totalIncome) + " ₽"
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "var(--fin-cream)", padding: "12px 16px 0" }}>
        <div className="searchbar">
          <Icon name="search" size={16} stroke="var(--fin-mute)" />
          <input
            type="search"
            placeholder="Поиск по магазинам, суммам…"
            aria-label="Поиск операций"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Icon name="filter" size={16} stroke="var(--fin-mute)" />
        </div>
        <div className="chips">
          {chips.map((chip) => {
            const isActive = chip.key === activeChip;
            const isAll = chip.key === "all";
            return (
              <button
                key={chip.key}
                type="button"
                className={
                  "chip" + (isActive ? (isAll ? " red" : " active") : "")
                }
                onClick={() => setActiveChip(chip.key)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="scroll" style={{ paddingTop: 6 }}>
        {hasError ? (
          <ErrorState
            onRetry={() => void transactionsQuery.refetch()}
            message="Не удалось загрузить операции"
          />
        ) : isLoading ? (
          <div className="card" style={{ padding: 12 }}>
            <Skeleton height={48} />
            <div style={{ height: 10 }} />
            <Skeleton height={48} />
            <div style={{ height: 10 }} />
            <Skeleton height={48} />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="Операций пока нет"
            description="Скажите голосом «потратил 1200 на такси» — ассистент запишет."
          />
        ) : (
          groups.map((day) => (
            <div key={day.key}>
              <div className="day-head">
                <span>{day.label}</span>
                <span className="sum">{formatDaySum(day.sum)}</span>
              </div>
              <div className="card" style={{ padding: "4px 16px" }}>
                {day.items.map((tx) => (
                  <TxRow
                    key={tx.id}
                    icon={categoryIcon(tx.category)}
                    iconBg={txIconBg(tx.type)}
                    name={tx.merchant || categoryLabel(tx.category)}
                    meta={txMeta(tx)}
                    amount={txAmount(tx)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
        <div style={{ height: 16 }} />
      </div>

      <button
        type="button"
        className="fab"
        aria-label="Добавить операцию"
        onClick={() => setSheetOpen(true)}
      >
        <Icon name="plus" size={22} stroke="white" />
      </button>

      <TransactionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </FinancePhone>
  );
}
