import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { listFinanceGoals } from "../../services/api";
import type { FinanceGoal } from "../../types/api";
import { GoalSheet } from "./components/forms";
import { Icon, type IconName } from "./components/Icon";
import {
  EmptyState,
  ErrorState,
  FinancePhone,
  Pill,
  SectionTitle,
  Skeleton,
  centsToRub,
  fmt,
} from "./components/shell";

type GoalRowProps = {
  icon: IconName;
  name: string;
  sub: string;
  current: number;
  target: number;
  until: string;
  pct: number;
  dark?: boolean;
};

function GoalRow({
  icon,
  name,
  sub,
  current,
  target,
  until,
  pct,
  dark,
}: GoalRowProps): ReactNode {
  return (
    <div
      className={"goal-card" + (dark ? " dark" : "")}
      style={{ marginBottom: 14 }}
    >
      <div className="row between">
        <div className="row gap">
          <div className="ico red-soft">
            <Icon name={icon} size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>{name}</div>
            <div
              className="tiny mute"
              style={dark ? { color: "rgba(255,255,255,.6)" } : undefined}
            >
              {sub}
            </div>
          </div>
        </div>
        <div
          className={"tiny" + (dark ? "" : " mute")}
          style={dark ? { color: "rgba(255,255,255,.7)" } : undefined}
        >
          {until}
        </div>
      </div>
      <div className="row between" style={{ marginTop: 14, marginBottom: 8 }}>
        <div className="num" style={{ fontWeight: 800 }}>
          {fmt(current)}{" "}
          <span style={{ opacity: 0.55 }}>/ {fmt(target)} ₽</span>
        </div>
        <div style={{ fontWeight: 800 }}>{pct}%</div>
      </div>
      <div
        className="pbar thin"
        style={dark ? { background: "rgba(255,255,255,.16)" } : undefined}
      >
        <i
          style={{
            width: pct + "%",
            background: dark ? "white" : "var(--fin-red)",
          }}
        />
      </div>
    </div>
  );
}

function goalIcon(title: string): IconName {
  const t = title.toLowerCase();
  if (t.includes("отпуск") || t.includes("путеш")) return "plane";
  if (t.includes("подушк") || t.includes("резерв") || t.includes("безоп"))
    return "shield";
  if (t.includes("дом") || t.includes("квартир") || t.includes("ипотек"))
    return "house";
  if (
    t.includes("мак") ||
    t.includes("комп") ||
    t.includes("ноут") ||
    t.includes("iphone") ||
    t.includes("телеф")
  )
    return "cpu";
  if (t.includes("маш") || t.includes("авто")) return "car";
  return "target";
}

function untilLabel(goal: FinanceGoal): string {
  if (!goal.target_date) return "без срока";
  const date = new Date(goal.target_date);
  return (
    "к " + date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  );
}

function pctOf(goal: FinanceGoal): number {
  if (goal.target_amount_cents <= 0) return 0;
  return Math.min(
    100,
    Math.round((goal.saved_amount_cents / goal.target_amount_cents) * 100),
  );
}

export function GoalsScreen(): ReactNode {
  const [sheetOpen, setSheetOpen] = useState(false);
  const goalsQuery = useQuery({
    queryKey: ["finance", "goals"],
    queryFn: listFinanceGoals,
  });

  const goals = goalsQuery.data ?? [];
  const active = goals.filter((g) => g.status === "active");
  const closed = goals.filter(
    (g) => g.status === "achieved" || g.status === "archived",
  );
  const featured = active[0];
  const rest = active.slice(1);

  const totalSaved = active.reduce(
    (sum, g) => sum + centsToRub(g.saved_amount_cents),
    0,
  );
  const totalTarget = active.reduce(
    (sum, g) => sum + centsToRub(g.target_amount_cents),
    0,
  );

  const isLoading = goalsQuery.isLoading;
  const hasError =
    goalsQuery.isError && !goalsQuery.data && !goalsQuery.isFetching;

  return (
    <FinancePhone title="Цели" activeTab="more" backTo="/finance/more">
      <div className="red-head">
        <div className="row between">
          <div className="hello">
            {active.length > 0
              ? `${active.length} активных целей`
              : "Финансовые цели"}
          </div>
          <button
            type="button"
            className="month-pill"
            style={{ border: "none", cursor: "pointer" }}
            onClick={() => setSheetOpen(true)}
          >
            <Icon name="plus" size={10} stroke="white" /> Новая
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            Накоплено всего
          </div>
          <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={200} height={36} />
            ) : (
              fmt(totalSaved) + " ₽"
            )}
          </div>
          <div className="sub">
            {isLoading
              ? "Загружаю цели…"
              : totalTarget > 0
                ? `из ${fmt(totalTarget)} ₽ суммарно`
                : "добавьте первую цель"}
          </div>
        </div>
      </div>

      <div className="scroll">
        {hasError ? (
          <ErrorState
            onRetry={() => void goalsQuery.refetch()}
            message="Не удалось загрузить цели"
          />
        ) : isLoading ? (
          <>
            <Skeleton height={160} />
            <div style={{ height: 14 }} />
            <Skeleton height={120} />
          </>
        ) : active.length === 0 ? (
          <EmptyState
            icon="target"
            title="Целей пока нет"
            description="Добавьте цель — отпуск, подушку, технику — и видите прогресс."
          />
        ) : (
          <>
            {featured ? (
              <div className="goal-card gradient" style={{ marginBottom: 14 }}>
                <div
                  className="row between"
                  style={{ position: "relative", zIndex: 2 }}
                >
                  <div className="ico glass">
                    <Icon
                      name={goalIcon(featured.title)}
                      size={18}
                      stroke="white"
                    />
                  </div>
                  <Pill tone="dark">{untilLabel(featured)}</Pill>
                </div>
                <div
                  style={{
                    marginTop: 14,
                    position: "relative",
                    zIndex: 2,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 18 }}>
                    {featured.title}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    position: "relative",
                    zIndex: 2,
                  }}
                >
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <div
                      className="num"
                      style={{ fontSize: 22, fontWeight: 800 }}
                    >
                      {fmt(centsToRub(featured.saved_amount_cents))}{" "}
                      <span style={{ opacity: 0.6 }}>
                        / {fmt(centsToRub(featured.target_amount_cents))} ₽
                      </span>
                    </div>
                    <div style={{ fontWeight: 800 }}>{pctOf(featured)}%</div>
                  </div>
                  <div
                    className="pbar thin"
                    style={{ background: "rgba(255,255,255,.22)" }}
                  >
                    <i
                      className="white"
                      style={{ width: pctOf(featured) + "%" }}
                    />
                  </div>
                </div>
                <div
                  className="ring"
                  style={{ background: "rgba(255,255,255,.12)" }}
                />
              </div>
            ) : null}

            {rest.map((goal, idx) => (
              <GoalRow
                key={goal.id}
                icon={goalIcon(goal.title)}
                name={goal.title}
                sub={
                  goal.linked_account_id ? "привязан счёт" : "ручное накопление"
                }
                current={centsToRub(goal.saved_amount_cents)}
                target={centsToRub(goal.target_amount_cents)}
                until={untilLabel(goal)}
                pct={pctOf(goal)}
                dark={idx % 2 === 1}
              />
            ))}
          </>
        )}

        {closed.length > 0 ? (
          <>
            <SectionTitle title="Закрытые цели" />
            {closed.map((goal) => (
              <div
                key={goal.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  marginBottom: 8,
                }}
              >
                <div className="ico green-soft">
                  <Icon name="check" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{goal.title}</div>
                  <div className="tiny mute">
                    {fmt(centsToRub(goal.target_amount_cents))} ₽ ·{" "}
                    {goal.status === "achieved" ? "достигнуто" : "архив"}
                  </div>
                </div>
                <Icon name="chevron-right" size={16} stroke="var(--fin-mute)" />
              </div>
            ))}
          </>
        ) : null}
        <button
          type="button"
          className="btn full ghost"
          style={{ marginTop: 12 }}
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="plus" size={14} /> Добавить цель
        </button>
        <div style={{ height: 16 }} />
      </div>
      <GoalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </FinancePhone>
  );
}
