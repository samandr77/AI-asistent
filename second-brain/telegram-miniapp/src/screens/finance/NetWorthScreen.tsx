import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  getFinanceNetWorth,
  getFinanceNetWorthProjection,
  listFinanceAssets,
  listFinanceDebts,
} from "../../services/api";
import type { FinanceNetWorthPoint } from "../../types/api";
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

function formatLargeRub(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return (m >= 10 ? m.toFixed(0) : m.toFixed(1)) + " млн";
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return (k >= 10 ? k.toFixed(0) : k.toFixed(1)) + " тыс";
  }
  return fmt(value);
}

function ProjBox({
  year,
  value,
  hi,
}: {
  year: string;
  value: string;
  hi?: boolean;
}): ReactNode {
  return (
    <div
      style={{
        background: hi ? "var(--fin-red)" : "rgba(255,255,255,.08)",
        borderRadius: 12,
        padding: "10px 8px",
      }}
    >
      <div
        className="tiny"
        style={{ opacity: hi ? 0.8 : 0.6, fontWeight: 700 }}
      >
        {year}
      </div>
      <div
        className="num"
        style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}

function CapRow({
  icon,
  name,
  value,
  neg,
}: {
  icon: IconName;
  name: string;
  value: number;
  neg?: boolean;
}): ReactNode {
  return (
    <div className="tx">
      <div className={`ico ${neg ? "red-soft" : "green-soft"}`}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{name}</div>
      <div
        className="num"
        style={{
          fontWeight: 800,
          color: neg ? "var(--fin-red)" : "var(--fin-ink)",
        }}
      >
        {neg ? "−" : ""}
        {fmt(Math.abs(value))} ₽
      </div>
    </div>
  );
}

function projectionPath(points: FinanceNetWorthPoint[]): string | null {
  if (points.length < 2) return null;
  const w = 320;
  const h = 100;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map((p) => centsToRub(p.net_worth_cents));
  const max = Math.max(...ys);
  const min = Math.min(...ys);
  const range = max - min || 1;
  const coords = points.map((_, i) => {
    const y = h - ((ys[i] - min) / range) * (h - 10) - 5;
    return `${xs[i]} ${y}`;
  });
  return "M" + coords.join(" L");
}

const ASSET_ICON_DEFAULT: IconName = "bank";
const DEBT_ICON_DEFAULT: IconName = "card";

export function NetWorthScreen(): ReactNode {
  const netWorthQuery = useQuery({
    queryKey: ["finance", "net-worth"],
    queryFn: getFinanceNetWorth,
  });
  const projectionQuery = useQuery({
    queryKey: ["finance", "net-worth-projection", 5],
    queryFn: () => getFinanceNetWorthProjection({ years: 5 }),
  });
  const assetsQuery = useQuery({
    queryKey: ["finance", "assets"],
    queryFn: listFinanceAssets,
  });
  const debtsQuery = useQuery({
    queryKey: ["finance", "debts"],
    queryFn: listFinanceDebts,
  });

  const netWorth = netWorthQuery.data;
  const projection = projectionQuery.data;
  const assets = assetsQuery.data ?? [];
  const debts = debtsQuery.data ?? [];

  const assetsRub = centsToRub(netWorth?.assets_cents);
  const debtsRub = centsToRub(netWorth?.debts_cents);
  const netWorthRub = centsToRub(netWorth?.net_worth_cents);

  const projectionPathStr = projection
    ? projectionPath(projection.points)
    : null;

  const projectionPoints = projection?.points ?? [];
  const projBoxes = [
    projectionPoints[Math.floor(projectionPoints.length / 3)],
    projectionPoints[Math.floor((2 * projectionPoints.length) / 3)],
    projectionPoints[projectionPoints.length - 1],
  ].filter(Boolean) as FinanceNetWorthPoint[];

  const isLoading = netWorthQuery.isLoading;
  const hasError =
    netWorthQuery.isError && !netWorthQuery.data && !netWorthQuery.isFetching;

  const hasData = netWorth && (assets.length > 0 || debts.length > 0);

  return (
    <FinancePhone
      title="Чистый капитал"
      activeTab="more"
      backTo="/finance/more"
    >
      <div className="red-head tall">
        <div className="row between">
          <div className="hello">Активы минус долги</div>
          <Pill>
            Текущее <Icon name="chevron-down" size={10} stroke="white" />
          </Pill>
        </div>
        {isLoading ? (
          <div style={{ marginTop: 14 }}>
            <Skeleton width={260} height={42} />
          </div>
        ) : (
          <h1 className="num">
            {fmt(netWorthRub)}
            <span className="cents"> ₽</span>
          </h1>
        )}
        <div className="sub">
          {isLoading
            ? "Загружаю капитал…"
            : projection
              ? `Прогноз ${projection.years} лет: ~ ${formatLargeRub(centsToRub(projection.projected_net_worth_cents))} ₽`
              : "Добавьте активы и долги, чтобы видеть динамику"}
        </div>
        {projectionPathStr ? (
          <svg
            viewBox="0 0 320 100"
            className="area-chart"
            style={{ marginTop: 14, height: 110 }}
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="nwFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity=".5" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={projectionPathStr + " L320 100 L0 100 Z"}
              fill="url(#nwFade)"
            />
            <path
              d={projectionPathStr}
              stroke="white"
              strokeWidth="2.5"
              fill="none"
            />
          </svg>
        ) : null}
      </div>

      <div className="scroll">
        {hasError ? (
          <ErrorState
            onRetry={() => void netWorthQuery.refetch()}
            message="Не удалось загрузить капитал"
          />
        ) : null}

        <div className="row gap" style={{ marginBottom: 14 }}>
          <div className="card" style={{ flex: 1 }}>
            <div className="label" style={{ fontSize: 10 }}>
              Активы
            </div>
            <div
              className="num"
              style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}
            >
              {isLoading ? (
                <Skeleton width={120} height={24} />
              ) : (
                fmt(assetsRub) + " ₽"
              )}
            </div>
            <div className="tiny mute" style={{ marginTop: 2 }}>
              {assets.length} активов
            </div>
          </div>
          <div className="card" style={{ flex: 1 }}>
            <div className="label" style={{ fontSize: 10 }}>
              Долги
            </div>
            <div
              className="num"
              style={{
                fontWeight: 800,
                fontSize: 22,
                marginTop: 4,
                color: "var(--fin-red)",
              }}
            >
              {isLoading ? (
                <Skeleton width={120} height={24} />
              ) : (
                "−" + fmt(debtsRub) + " ₽"
              )}
            </div>
            <div className="tiny mute" style={{ marginTop: 2 }}>
              {debts.length} долгов
            </div>
          </div>
        </div>

        {!isLoading && !hasData ? (
          <EmptyState
            icon="trend-up"
            title="Капитал пока пустой"
            description="Добавьте брокерский счёт, недвижимость или долги — увидите прогноз."
          />
        ) : null}

        {projection && projBoxes.length === 3 ? (
          <>
            <SectionTitle title="Прогноз ассистента" style={{ marginTop: 4 }} />
            <div
              className="card big"
              style={{ background: "var(--fin-ink)", color: "white" }}
            >
              <div className="row gap">
                <div
                  className="ico"
                  style={{ background: "rgba(255,255,255,.14)" }}
                >
                  <Icon name="sparkles" size={16} stroke="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>
                    Через {projection.years} лет: ~{" "}
                    {formatLargeRub(
                      centsToRub(projection.projected_net_worth_cents),
                    )}{" "}
                    ₽
                  </div>
                  <div
                    className="small"
                    style={{ opacity: 0.75, marginTop: 4 }}
                  >
                    При среднем кэшфлоу{" "}
                    {fmt(centsToRub(projection.monthly_cash_flow_cents))} ₽ в
                    месяц.
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                {projBoxes.map((p, idx) => (
                  <ProjBox
                    key={p.date}
                    year={new Date(p.date).getFullYear().toString()}
                    value={formatLargeRub(centsToRub(p.net_worth_cents))}
                    hi={idx === projBoxes.length - 1}
                  />
                ))}
              </div>
            </div>
          </>
        ) : null}

        {assets.length + debts.length > 0 ? (
          <>
            <SectionTitle title="Состав капитала" />
            <div className="card">
              {assets.map((a) => (
                <CapRow
                  key={a.id}
                  icon={ASSET_ICON_DEFAULT}
                  name={a.name}
                  value={centsToRub(a.current_value_cents)}
                />
              ))}
              {debts.map((d) => (
                <CapRow
                  key={d.id}
                  icon={DEBT_ICON_DEFAULT}
                  name={d.name}
                  value={-centsToRub(d.balance_cents)}
                  neg
                />
              ))}
            </div>
          </>
        ) : null}

        <div
          className="tiny mute"
          style={{
            marginTop: 14,
            padding: 12,
            background: "var(--fin-cream-2)",
            borderRadius: 12,
          }}
        >
          Прогноз ассистента — это сценарий при текущем темпе сбережений. Это не
          инвестиционная рекомендация.
        </div>

        <div style={{ height: 16 }} />
      </div>
    </FinancePhone>
  );
}
