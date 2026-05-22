import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Icon, type IconName } from "./Icon";

import "../finance.css";

export function fmtRub(n: number): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return sign + abs.toLocaleString("ru-RU") + " ₽";
}

export function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function centsToRub(cents: number | null | undefined): number {
  return Math.round((cents ?? 0) / 100);
}

export function fmtCentsRub(cents: number | null | undefined): string {
  return fmtRub(centsToRub(cents));
}

export function fmtCents(cents: number | null | undefined): string {
  return fmt(centsToRub(cents));
}

const CATEGORY_LABELS: Record<string, string> = {
  food: "Продукты",
  groceries: "Продукты",
  cafe: "Кафе и рестораны",
  restaurants: "Кафе и рестораны",
  transport: "Транспорт",
  taxi: "Такси",
  subscriptions: "Подписки",
  salary: "Зарплата",
  rent: "Аренда",
  housing: "Жильё и ЖКХ",
  utilities: "Жильё и ЖКХ",
  health: "Здоровье",
  entertainment: "Развлечения",
  shopping: "Шопинг",
  other: "Другое",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

const CATEGORY_ICONS: Record<string, IconName> = {
  food: "cart",
  groceries: "cart",
  cafe: "cafe",
  restaurants: "cafe",
  transport: "car",
  taxi: "car",
  subscriptions: "cpu",
  salary: "briefcase",
  rent: "house",
  housing: "house",
  utilities: "house",
  health: "shield",
  entertainment: "film",
  shopping: "gift",
  other: "tag",
};

export function categoryIcon(category: string): IconName {
  return CATEGORY_ICONS[category] ?? "tag";
}

export function Skeleton({
  width,
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}): ReactNode {
  return (
    <div
      className="fin-skel"
      style={{
        width: width ?? "100%",
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function EmptyState({
  icon = "piggy",
  title,
  description,
}: {
  icon?: IconName;
  title: string;
  description?: string;
}): ReactNode {
  return (
    <div className="fin-empty">
      <div className="ico big red-soft">
        <Icon name={icon} size={22} />
      </div>
      <div className="fin-empty-title">{title}</div>
      {description ? <div className="fin-empty-desc">{description}</div> : null}
    </div>
  );
}

export function ErrorState({
  onRetry,
  message = "Не удалось загрузить",
}: {
  onRetry?: () => void;
  message?: string;
}): ReactNode {
  return (
    <div className="fin-error">
      <div className="fin-empty-title">{message}</div>
      {onRetry ? (
        <button type="button" className="btn ghost" onClick={onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  );
}

type FinancePhoneProps = PropsWithChildren<{
  title: string;
  backTo?: string;
  activeTab: TabKey;
  hideTabBar?: boolean;
}>;

export function FinancePhone({
  title,
  backTo,
  activeTab,
  hideTabBar = false,
  children,
}: FinancePhoneProps): ReactNode {
  const navigate = useNavigate();
  return (
    <div className="finance-app">
      <FinanceTopBar
        title={title}
        onBack={backTo ? () => navigate(backTo) : () => navigate(-1)}
      />
      {children}
      {hideTabBar ? null : <FinanceTabBar active={activeTab} />}
    </div>
  );
}

type TopBarProps = {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
};

export function FinanceTopBar({
  title,
  onBack,
  onClose,
}: TopBarProps): ReactNode {
  return (
    <div className="tg-bar">
      <button
        type="button"
        className="tg-back"
        aria-label="Назад"
        onClick={onBack}
      >
        <Icon name="chevron-left" size={16} />
      </button>
      <div className="tg-title">{title}</div>
      {onClose ? (
        <button
          type="button"
          className="tg-close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <Icon name="close" size={12} />
        </button>
      ) : (
        <span aria-hidden="true" className="tg-bar__spacer" />
      )}
    </div>
  );
}

type PillProps = PropsWithChildren<{
  tone?: "translucent" | "dark";
  style?: CSSProperties;
}>;

export function Pill({
  tone = "translucent",
  style,
  children,
}: PillProps): ReactNode {
  return (
    <span
      className={"month-pill" + (tone === "dark" ? " dark" : "")}
      style={style}
    >
      {children}
    </span>
  );
}

export type TabKey = "overview" | "transactions" | "budgets" | "ai" | "more";

type TabDef = {
  key: TabKey;
  label: string;
  icon: IconName;
  to: string;
};

export const FINANCE_TABS: TabDef[] = [
  { key: "overview", label: "Обзор", icon: "home", to: "/finance" },
  {
    key: "transactions",
    label: "Операции",
    icon: "list",
    to: "/finance/transactions",
  },
  { key: "budgets", label: "Бюджет", icon: "wallet", to: "/finance/budgets" },
  { key: "ai", label: "ИИ", icon: "sparkles", to: "/finance/ai" },
  { key: "more", label: "Ещё", icon: "pie", to: "/finance/more" },
];

export function FinanceTabBar({ active }: { active: TabKey }): ReactNode {
  const location = useLocation();
  return (
    <nav className="tabbar" aria-label="Финансы">
      {FINANCE_TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            className={"tab" + (isActive ? " active" : "")}
            state={{ from: location.pathname }}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              name={tab.icon}
              size={20}
              stroke={isActive ? "var(--fin-red)" : "var(--fin-mute)"}
            />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

type SegmentedProps = {
  items: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
};

export function Segmented({
  items,
  active,
  onChange,
}: SegmentedProps): ReactNode {
  return (
    <div className="segs">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={"s" + (item.key === active ? " on" : "")}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

type SectionTitleProps = {
  title: string;
  action?: { label: string; onClick?: () => void };
  style?: CSSProperties;
};

export function SectionTitle({
  title,
  action,
  style,
}: SectionTitleProps): ReactNode {
  return (
    <div className="section-title" style={style}>
      <h3>{title}</h3>
      {action ? (
        <button type="button" className="more" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

type AlertProps = {
  tone?: "warning" | "danger" | "info";
  iconBg: "red" | "red-soft" | "amber-soft" | "blue-soft" | "green-soft";
  icon: IconName;
  iconStroke?: string;
  title: string;
  description: string;
  trailing?: ReactNode;
};

export function Alert({
  tone = "warning",
  iconBg,
  icon,
  iconStroke,
  title,
  description,
  trailing,
}: AlertProps): ReactNode {
  const cls = tone === "warning" ? "alert" : `alert ${tone}`;
  return (
    <div className={cls}>
      <div className={`ico ${iconBg}`}>
        <Icon name={icon} size={16} stroke={iconStroke} />
      </div>
      <div className="body">
        <div className="t">{title}</div>
        <div className="d">{description}</div>
      </div>
      {trailing}
    </div>
  );
}
