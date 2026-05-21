import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Icon, type TaskIconName } from "./Icon";

import "../tasks.css";

export type TaskSphere = "work" | "health" | "finance" | "personal" | "mind";

export const SPHERES: Record<TaskSphere, { label: string; color: string }> = {
  work: { label: "Работа", color: "var(--sphere-work)" },
  health: { label: "Здоровье", color: "var(--sphere-health)" },
  finance: { label: "Финансы", color: "var(--sphere-finance)" },
  personal: { label: "Личное", color: "var(--sphere-personal)" },
  mind: { label: "Ум", color: "var(--sphere-mind)" },
};

export function TasksApp({ children }: PropsWithChildren) {
  return <div className="tasks-app">{children}</div>;
}

export function Screen({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`scr${className ? ` ${className}` : ""}`}>{children}</div>
  );
}

export function ScreenBody({
  children,
  style,
}: PropsWithChildren<{ style?: CSSProperties }>) {
  return (
    <div className="scr-body" style={style}>
      {children}
    </div>
  );
}

export function TopBar({
  left,
  right,
  eyebrow,
  title,
  subtitle,
}: {
  left?: ReactNode;
  right?: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="top-bar">
      <div className="top-bar-row">
        <div className="top-bar-group">{left}</div>
        <div className="top-bar-group">{right}</div>
      </div>
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      {title ? <div className="title">{title}</div> : null}
      {subtitle ? <div className="subtitle">{subtitle}</div> : null}
    </div>
  );
}

export function BackBtn({ to }: { to?: string }) {
  const navigate = useNavigate();
  function go() {
    if (to) navigate(to);
    else navigate(-1);
  }
  return (
    <button
      type="button"
      className="icon-btn on-card"
      onClick={go}
      aria-label="Назад"
    >
      <Icon name="chevron-left" size={18} color="var(--ink-700)" />
    </button>
  );
}

export function IconBtn({
  name,
  onClick,
  to,
  variant = "default",
  ariaLabel,
}: {
  name: TaskIconName;
  onClick?: () => void;
  to?: string;
  variant?: "default" | "on-card";
  ariaLabel?: string;
}) {
  const cls = `icon-btn${variant === "on-card" ? " on-card" : ""}`;
  const content = <Icon name={name} size={18} color="var(--ink-700)" />;
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={ariaLabel ?? name}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-label={ariaLabel ?? name}
    >
      {content}
    </button>
  );
}

export function AIChip({
  text,
  cta = "Открыть",
  onCta,
}: {
  text: ReactNode;
  cta?: string | null;
  onCta?: () => void;
}) {
  return (
    <div className="ai-chip">
      <div className="ai-dot">AI</div>
      <div style={{ flex: 1 }}>{text}</div>
      {cta ? (
        <button type="button" className="ai-cta" onClick={onCta}>
          {cta} →
        </button>
      ) : null}
    </div>
  );
}

export function SphereChip({ sphere }: { sphere: TaskSphere }) {
  const s = SPHERES[sphere];
  return (
    <span className="chip">
      <span className="sw" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export type TaskRowData = {
  id?: string;
  name: string;
  time?: string;
  eta?: string;
  sphere?: TaskSphere;
  project?: string;
  context?: string;
  tags?: string[];
  flag?: boolean;
  done?: boolean;
};

export function TaskRow({
  task,
  to,
  onClick,
  onToggle,
}: {
  task: TaskRowData;
  to?: string;
  onClick?: () => void;
  onToggle?: () => void;
}) {
  const body = (
    <>
      <button
        type="button"
        className={`check${task.done ? " done" : ""}`}
        onClick={
          onToggle
            ? (e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggle();
              }
            : undefined
        }
        aria-label={task.done ? "Снять отметку" : "Отметить выполненным"}
      />
      <div className="body">
        <div className={`name${task.done ? " done" : ""}`}>{task.name}</div>
        {task.time ||
        task.sphere ||
        task.tags ||
        task.context ||
        task.project ||
        task.eta ||
        task.flag ? (
          <div className="meta">
            {task.time ? (
              <span className="time">
                <Icon
                  name="clock"
                  size={11}
                  color="var(--ink-400)"
                  strokeWidth={2}
                />
                {task.time}
              </span>
            ) : null}
            {task.eta ? (
              <span className="time" style={{ color: "var(--ink-400)" }}>
                · {task.eta}
              </span>
            ) : null}
            {task.sphere ? <SphereChip sphere={task.sphere} /> : null}
            {task.project ? (
              <span className="chip">
                <Icon
                  name="folder"
                  size={10}
                  color="var(--ink-500)"
                  strokeWidth={2}
                />
                {task.project}
              </span>
            ) : null}
            {task.context ? (
              <span className="chip ctx">{task.context}</span>
            ) : null}
            {task.tags?.map((tag) => (
              <span key={tag} className="chip tag">
                {tag}
              </span>
            ))}
            {task.flag ? (
              <span
                className="pill"
                style={{
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                }}
              >
                <Icon
                  name="flag"
                  size={10}
                  color="var(--danger)"
                  strokeWidth={2.2}
                />{" "}
                Срочно
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="task" style={{ textDecoration: "none" }}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className="task" onClick={onClick}>
      {body}
    </button>
  );
}

type TabId = "home" | "tasks" | "fab" | "focus" | "me";

const TABS: { id: TabId; label: string; icon: TaskIconName; to?: string }[] = [
  { id: "home", label: "Дом", icon: "home", to: "/today" },
  { id: "tasks", label: "Задачи", icon: "check", to: "/tasks" },
  { id: "fab", label: "", icon: "plus", to: "/dump" },
  { id: "focus", label: "Фокус", icon: "target", to: "/tasks/focus" },
  { id: "me", label: "Я", icon: "user", to: "/profile" },
];

export function TabBar({ active }: { active?: TabId }) {
  const location = useLocation();
  const inferred: TabId =
    active ??
    (location.pathname.startsWith("/tasks/focus")
      ? "focus"
      : location.pathname.startsWith("/tasks")
        ? "tasks"
        : location.pathname.startsWith("/profile")
          ? "me"
          : location.pathname.startsWith("/dump")
            ? "fab"
            : "home");

  return (
    <nav className="tabbar" aria-label="Нижняя навигация">
      {TABS.map((t) =>
        t.id === "fab" ? (
          <Link
            key={t.id}
            to={t.to ?? "#"}
            className="tab fab"
            aria-label="Добавить"
          >
            <Icon name="plus" size={22} color="#fff" strokeWidth={2.2} />
          </Link>
        ) : (
          <Link
            key={t.id}
            to={t.to ?? "#"}
            className={`tab${inferred === t.id ? " active" : ""}`}
          >
            <Icon
              name={t.icon}
              size={22}
              color={inferred === t.id ? "var(--accent)" : "var(--ink-400)"}
            />
            <div>{t.label}</div>
          </Link>
        ),
      )}
    </nav>
  );
}

export function DateStrip({
  days,
  activeIdx = 2,
  onSelect,
}: {
  days: { dow: string; day: number; dot?: boolean }[];
  activeIdx?: number;
  onSelect?: (idx: number) => void;
}) {
  return (
    <div className="date-strip">
      {days.map((d, i) => (
        <button
          key={`${d.dow}-${d.day}`}
          type="button"
          className={`date-cell${i === activeIdx ? " active" : ""}`}
          onClick={onSelect ? () => onSelect(i) : undefined}
        >
          <div className="dow">{d.dow}</div>
          <div className="day">{d.day}</div>
          {d.dot ? <div className="dot" /> : null}
        </button>
      ))}
    </div>
  );
}
