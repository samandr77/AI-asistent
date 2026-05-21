import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const navigationItems = [
  { to: "/today", label: "Сегодня" },
  { to: "/dump", label: "Запись" },
  { to: "/tasks", label: "Задачи" },
  { to: "/tasks/inbox", label: "Инбокс" },
  { to: "/goals", label: "Цели" },
  { to: "/finance", label: "Финансы" },
  { to: "/reflections", label: "Рефлексии" },
  { to: "/profile", label: "Профиль" },
  { to: "/support", label: "Поддержка" },
];

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className="app-shell">
      <button
        type="button"
        className="hamburger-button"
        aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
        aria-controls="app-navigation"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span />
        <span />
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
        className={`app-menu ${isOpen ? "open" : ""}`}
        aria-label="Разделы приложения"
        aria-hidden={!isOpen}
      >
        <div className="app-menu__handle" />
        <div className="app-menu__header">
          <strong>Second Brain</strong>
          <span>Разделы</span>
        </div>
        <div className="app-menu__links">
          {navigationItems.map((item) => {
            const isActive = item.to === activePath;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={isActive ? "active" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
