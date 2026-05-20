import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { getFinanceNetWorth, listFinanceAssets } from "../../services/api";
import type { FinanceAsset } from "../../types/api";
import { AssetSheet } from "./components/forms";
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

const ASSET_TYPE_LABEL: Record<FinanceAsset["type"], string> = {
  cash: "Кэш и вклады",
  brokerage: "Акции и ETF",
  retirement: "Пенсионный",
  real_estate: "Недвижимость",
  vehicle: "Транспорт",
  other: "Другое",
};

const ASSET_ICON: Record<FinanceAsset["type"], IconName> = {
  cash: "bank",
  brokerage: "trend-up",
  retirement: "shield",
  real_estate: "house",
  vehicle: "car",
  other: "tag",
};

const ASSET_COLOR: Record<FinanceAsset["type"], string> = {
  cash: "var(--fin-green)",
  brokerage: "var(--fin-red)",
  retirement: "var(--fin-blue)",
  real_estate: "var(--fin-amber)",
  vehicle: "var(--fin-ink)",
  other: "var(--fin-mute)",
};

function AllocItem({
  dot,
  name,
  value,
}: {
  dot: string;
  name: string;
  value: string;
}): ReactNode {
  return (
    <div className="row gap" style={{ alignItems: "flex-start" }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: dot,
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div>
        <div className="tiny mute" style={{ fontWeight: 700 }}>
          {name}
        </div>
        <div className="num small" style={{ fontWeight: 800 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function AssetRow({
  icon,
  name,
  sub,
  value,
}: {
  icon: IconName;
  name: string;
  sub: string;
  value: number;
}): ReactNode {
  return (
    <div className="sub-row">
      <div className="ico big red-soft">
        <Icon name={icon} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div className="tiny mute">{sub}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="num" style={{ fontWeight: 800 }}>
          {fmt(value)} ₽
        </div>
      </div>
    </div>
  );
}

export function AssetsScreen(): ReactNode {
  const [sheetOpen, setSheetOpen] = useState(false);
  const assetsQuery = useQuery({
    queryKey: ["finance", "assets"],
    queryFn: listFinanceAssets,
  });
  const netWorthQuery = useQuery({
    queryKey: ["finance", "net-worth"],
    queryFn: getFinanceNetWorth,
  });

  const assets = assetsQuery.data ?? [];
  const netWorth = netWorthQuery.data;

  const totalValue = assets.reduce(
    (sum, a) => sum + centsToRub(a.current_value_cents),
    0,
  );

  const allocation = useMemo(() => {
    const byType = new Map<FinanceAsset["type"], number>();
    for (const asset of assets) {
      const rub = centsToRub(asset.current_value_cents);
      byType.set(asset.type, (byType.get(asset.type) ?? 0) + rub);
    }
    const items = Array.from(byType.entries()).map(([type, value]) => ({
      type,
      value,
      pct: totalValue > 0 ? Math.round((value / totalValue) * 100) : 0,
    }));
    items.sort((a, b) => b.value - a.value);
    return items;
  }, [assets, totalValue]);

  const isLoading = assetsQuery.isLoading;
  const hasError =
    assetsQuery.isError && !assetsQuery.data && !assetsQuery.isFetching;

  return (
    <FinancePhone title="Активы" activeTab="more" backTo="/finance/more">
      <div className="red-head">
        <div className="row between">
          <div className="hello">
            {assets.length > 0
              ? `Портфель · ${assets.length} активов`
              : "Активы"}
          </div>
          <Pill>
            Текущее <Icon name="chevron-down" size={10} stroke="white" />
          </Pill>
        </div>
        <div style={{ marginTop: 14 }}>
          <div
            className="label"
            style={{ color: "rgba(255,255,255,.7)", fontSize: 10 }}
          >
            Стоимость портфеля
          </div>
          <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>
            {isLoading ? (
              <Skeleton width={240} height={36} />
            ) : (
              fmt(totalValue) + " ₽"
            )}
          </div>
          {netWorth ? (
            <div className="sub">
              Чистый капитал{" "}
              <b className="num">
                {fmt(centsToRub(netWorth.net_worth_cents))} ₽
              </b>
            </div>
          ) : null}
        </div>
      </div>

      <div className="scroll">
        {hasError ? (
          <ErrorState
            onRetry={() => void assetsQuery.refetch()}
            message="Не удалось загрузить активы"
          />
        ) : isLoading ? (
          <>
            <Skeleton height={140} />
            <div style={{ height: 12 }} />
            <Skeleton height={64} />
            <div style={{ height: 10 }} />
            <Skeleton height={64} />
          </>
        ) : assets.length === 0 ? (
          <EmptyState
            icon="bank"
            title="Активов пока нет"
            description="Добавьте брокерский счёт, накопительный счёт или недвижимость."
          />
        ) : (
          <>
            <div className="card big">
              <div className="label" style={{ fontSize: 10 }}>
                Распределение по классам
              </div>
              <div className="alloc" style={{ marginTop: 12 }}>
                {allocation.map((item) => (
                  <span
                    key={item.type}
                    style={{
                      width: item.pct + "%",
                      background: ASSET_COLOR[item.type],
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  rowGap: 10,
                  columnGap: 12,
                }}
              >
                {allocation.map((item) => (
                  <AllocItem
                    key={item.type}
                    dot={ASSET_COLOR[item.type]}
                    name={ASSET_TYPE_LABEL[item.type]}
                    value={`${item.pct}% · ${fmt(item.value)} ₽`}
                  />
                ))}
              </div>
            </div>

            <SectionTitle
              title="Счета и активы"
              action={{
                label: "+ добавить",
                onClick: () => setSheetOpen(true),
              }}
            />

            {assets.map((asset) => (
              <AssetRow
                key={asset.id}
                icon={ASSET_ICON[asset.type]}
                name={asset.name}
                sub={`${ASSET_TYPE_LABEL[asset.type]} · ${asset.currency}`}
                value={centsToRub(asset.current_value_cents)}
              />
            ))}
          </>
        )}

        <button
          type="button"
          className="btn full ghost"
          style={{ marginTop: 12 }}
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="plus" size={14} /> Добавить актив
        </button>
        <div style={{ height: 16 }} />
      </div>
      <AssetSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </FinancePhone>
  );
}
