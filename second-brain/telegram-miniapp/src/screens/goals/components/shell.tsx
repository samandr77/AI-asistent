import type { PropsWithChildren, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import "../goals.css";
import { Icon, type TaskIconName } from "../../tasks/components/Icon";

/** Root wrapper — applies the .goals-app design-system scope. */
export function GoalsApp({ children }: PropsWithChildren) {
  return <div className="goals-app">{children}</div>;
}

/** Standard screen scaffold. */
export function GoalsScreenLayout({
  children,
  withTabBar = true,
}: PropsWithChildren<{ withTabBar?: boolean }>) {
  return (
    <GoalsApp>
      <div className="g-screen">
        {children}
        {withTabBar ? <GoalsTabBar /> : null}
      </div>
    </GoalsApp>
  );
}

export function GoalsBody({ children }: PropsWithChildren) {
  return <div className="g-body">{children}</div>;
}

export function GoalsTopBar({
  back,
  title,
  eyebrow,
  right,
}: {
  back?: string;
  title: string;
  eyebrow?: string;
  right?: ReactNode;
}) {
  return (
    <div className="g-topbar">
      {back ? (
        <Link to={back} className="g-topbar__back" aria-label="Назад">
          <Icon
            name="chevron-left"
            size={18}
            color="#3A2F70"
            strokeWidth={2.2}
          />
        </Link>
      ) : null}
      <div className="g-topbar__title">
        <strong>{title}</strong>
        {eyebrow ? <span>{eyebrow}</span> : null}
      </div>
      {right}
    </div>
  );
}

export function GoalsIconButton({
  to,
  ariaLabel,
  icon,
  onClick,
}: {
  to?: string;
  ariaLabel: string;
  icon: TaskIconName;
  onClick?: () => void;
}) {
  const inner = <Icon name={icon} size={16} color="#3A2F70" />;
  if (to) {
    return (
      <Link to={to} className="g-icon-btn" aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="g-icon-btn"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {inner}
    </button>
  );
}

export function GoalsTabBar() {
  const location = useLocation();
  const items: { to: string; label: string; icon: TaskIconName }[] = [
    { to: "/goals", label: "Дерево", icon: "target" },
    { to: "/goals/strategy", label: "Стратегия", icon: "sparkle" },
    { to: "/goals/kpi", label: "KPI", icon: "chart" },
    { to: "/goals/review", label: "Ревью", icon: "trend" },
    { to: "/goals/more", label: "Ещё", icon: "more" },
  ];
  return (
    <nav className="g-tabbar" aria-label="Цели — навигация">
      {items.map((it) => {
        const isActive =
          location.pathname === it.to ||
          location.pathname.startsWith(`${it.to}/`);
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`g-tabbar__tab ${isActive ? "active" : ""}`}
          >
            <Icon
              name={it.icon}
              size={20}
              color={isActive ? "#6E5BF6" : "#9D94C3"}
            />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Level label localization. */
export function levelLabel(level: string): string {
  switch (level) {
    case "life":
      return "Жизнь";
    case "year":
      return "Год";
    case "quarter":
      return "Квартал";
    case "week":
      return "Неделя";
    default:
      return level;
  }
}

export function levelColor(level: string): { color: string; tint: string } {
  switch (level) {
    case "life":
      return { color: "#4F3ED1", tint: "#E5DEFB" };
    case "year":
      return { color: "#6E5BF6", tint: "#E9E2F5" };
    case "quarter":
      return { color: "#2E5BFF", tint: "#E2EAFF" };
    case "week":
      return { color: "#0EA5E9", tint: "#DDF1FB" };
    default:
      return { color: "#5C6F92", tint: "#EEF3FB" };
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "on_track":
      return "В графике";
    case "at_risk":
      return "Риск";
    case "off_track":
      return "Срыв";
    case "done":
      return "Готово";
    case "active":
      return "Активна";
    case "paused":
      return "Пауза";
    case "achieved":
      return "Достигнута";
    case "archived":
      return "Архив";
    case "ok":
      return "В норме";
    case "warning":
      return "Внимание";
    case "breach":
      return "Срыв";
    default:
      return status;
  }
}
