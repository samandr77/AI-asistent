import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Icon, type HealthIconName } from "./Icon";

import "../health.css";

export function HealthApp({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={"health-app" + (className ? ` ${className}` : "")}>
      {children}
    </div>
  );
}

export function HealthScreenLayout({
  children,
  style,
}: PropsWithChildren<{ style?: CSSProperties }>) {
  return (
    <div className="health-screen" style={style}>
      {children}
    </div>
  );
}

export function HealthBody({
  children,
  style,
  className,
}: PropsWithChildren<{ style?: CSSProperties; className?: string }>) {
  return (
    <div
      className={"health-body" + (className ? ` ${className}` : "")}
      style={style}
    >
      {children}
    </div>
  );
}

export function HealthTopBar({
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
    <div className="health-topbar">
      <div className="health-topbar-row">
        <div className="health-topbar-side">{left}</div>
        <div className="health-topbar-side health-topbar-side-end">{right}</div>
      </div>
      {(title || eyebrow || subtitle) && (
        <div className="health-topbar-head">
          {eyebrow ? (
            <div className="health-topbar-eyebrow">{eyebrow}</div>
          ) : null}
          {title ? <h1 className="health-topbar-title">{title}</h1> : null}
          {subtitle ? (
            <div className="health-topbar-subtitle">{subtitle}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function HealthBackButton({
  fallback = "/health",
  label = "Назад",
}: {
  fallback?: string;
  label?: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="health-iconbtn"
      aria-label={label}
      onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate(fallback);
      }}
    >
      <Icon name="back" size={22} />
    </button>
  );
}

export function HealthIconButton({
  name,
  onClick,
  label,
  size = 20,
  active,
  disabled,
}: {
  name: HealthIconName;
  onClick: () => void;
  label: string;
  size?: number;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={"health-iconbtn" + (active ? " is-on" : "")}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

export function HealthCta({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: PropsWithChildren<{
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
}>) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`health-cta health-cta--${variant}`}
    >
      {children}
    </button>
  );
}

export function SectionTitle({
  children,
  action,
}: PropsWithChildren<{ action?: ReactNode }>) {
  return (
    <div className="health-section-title">
      <span>{children}</span>
      {action ? <span className="health-section-action">{action}</span> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="health-empty">
      <div className="health-empty-title">{title}</div>
      {description ? (
        <div className="health-empty-desc">{description}</div>
      ) : null}
      {action ? <div className="health-empty-action">{action}</div> : null}
    </div>
  );
}
