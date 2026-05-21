import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Icon, type TaskIconName } from "../screens/tasks/components/Icon";

type NavItem = {
  to: string;
  label: string;
  icon: TaskIconName;
  color: string;
  tint: string;
};

const navigationItems: NavItem[] = [
  {
    to: "/today",
    label: "Сегодня",
    icon: "home",
    color: "#0EA5E9",
    tint: "#DDF1FB",
  },
  {
    to: "/dump",
    label: "Запись",
    icon: "mic",
    color: "#2E5BFF",
    tint: "#E2EAFF",
  },
  {
    to: "/tasks",
    label: "Задачи",
    icon: "check",
    color: "#2E5BFF",
    tint: "#E2EAFF",
  },
  {
    to: "/tasks/inbox",
    label: "Инбокс",
    icon: "inbox",
    color: "#0EA5E9",
    tint: "#DDF1FB",
  },
  {
    to: "/goals",
    label: "Цели",
    icon: "target",
    color: "#6E5BF6",
    tint: "#E5DEFB",
  },
  {
    to: "/finance",
    label: "Финансы",
    icon: "chart",
    color: "#E04F5F",
    tint: "#FBE1E4",
  },
  {
    to: "/today",
    label: "Здоровье",
    icon: "fire",
    color: "#1FA67A",
    tint: "#D6F0E3",
  },
  {
    to: "/reflections",
    label: "Рефлексии",
    icon: "sparkle",
    color: "#DC8A1E",
    tint: "#FBEAD0",
  },
  {
    to: "/profile",
    label: "Профиль",
    icon: "user",
    color: "#5C6F92",
    tint: "#EEF3FB",
  },
  {
    to: "/support",
    label: "Поддержка",
    icon: "info",
    color: "#5C6F92",
    tint: "#EEF3FB",
  },
];

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activePath = navigationItems
    .slice()
    .sort((left, right) => right.to.length - left.to.length)
    .find(
      (item) =>
        location.pathname === item.to ||
        location.pathname.startsWith(`${item.to}/`),
    )?.to;

  useEffect(() => {
    setIsOpen(false);
    setSearch("");
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  const filtered = search.trim()
    ? navigationItems.filter((item) =>
        item.label.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : navigationItems;

  return (
    <div className="app-menu-shell">
      <button
        type="button"
        className="app-menu-trigger"
        aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
        aria-controls="app-navigation"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span />
      </button>

      {isOpen ? (
        <button
          type="button"
          className="app-menu-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <nav
        id="app-navigation"
        className={`app-menu-sheet ${isOpen ? "open" : ""}`}
        aria-label="Разделы приложения"
        aria-hidden={!isOpen}
      >
        <div className="app-menu-sheet__handle" aria-hidden="true" />

        <div className="app-menu-sheet__head">
          <div className="app-menu-sheet__brand">
            <div className="app-menu-sheet__logo" aria-hidden="true">
              SB
            </div>
            <div>
              <div className="app-menu-sheet__brand-title">Second Brain</div>
              <div className="app-menu-sheet__brand-sub">все разделы жизни</div>
            </div>
          </div>
          <div className="app-menu-sheet__count">
            {navigationItems.length} разделов
          </div>
        </div>

        <div className="app-menu-sheet__search">
          <Icon name="search" size={14} color="#8395B3" />
          <input
            type="text"
            className="app-menu-sheet__search-input"
            placeholder="Найти раздел…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Поиск раздела"
          />
          <span className="app-menu-sheet__search-kbd">⌘K</span>
        </div>

        <div className="app-menu-sheet__grid">
          {filtered.map((item) => {
            const isActive = item.to === activePath;
            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                className={`app-menu-sheet__item ${isActive ? "active" : ""}`}
                style={
                  isActive
                    ? {
                        background: item.color,
                        boxShadow: `0 10px 22px ${item.color}40`,
                      }
                    : undefined
                }
              >
                <span
                  className="app-menu-sheet__item-icon"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.18)" : item.tint,
                  }}
                >
                  <Icon
                    name={item.icon}
                    size={14}
                    color={isActive ? "#fff" : item.color}
                    strokeWidth={2.2}
                  />
                </span>
                <span className="app-menu-sheet__item-label">{item.label}</span>
                {isActive ? (
                  <Icon name="check" size={14} color="#fff" strokeWidth={2.4} />
                ) : (
                  <Icon
                    name="chevron"
                    size={11}
                    color="#B0BCD2"
                    strokeWidth={2.2}
                  />
                )}
              </Link>
            );
          })}
        </div>

        <div className="app-menu-sheet__footer">
          <div className="app-menu-sheet__ai-dot" aria-hidden="true">
            AI
          </div>
          <div className="app-menu-sheet__ai-text">
            Скажи «открой Финансы» — голосом тоже работает
          </div>
          <Icon name="mic" size={14} color="#8395B3" />
        </div>
      </nav>

      {children}
    </div>
  );
}
