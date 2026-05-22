import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Icon, type TaskIconName } from "../screens/tasks/components/Icon";
import { AiInputSheet } from "./AiInputSheet";

type Tab = {
  to: string;
  label: string;
  icon: TaskIconName;
  matchPrefix?: string;
};

const TABS_LEFT: Tab[] = [
  { to: "/today", label: "Дом", icon: "home" },
  { to: "/tasks", label: "Задачи", icon: "check", matchPrefix: "/tasks" },
];

const TABS_RIGHT: Tab[] = [
  { to: "/finance", label: "Финансы", icon: "chart", matchPrefix: "/finance" },
  { to: "/health", label: "Здоровье", icon: "fire", matchPrefix: "/health" },
];

export function AppTabBar() {
  const location = useLocation();
  const [aiOpen, setAiOpen] = useState(false);

  function isActive(tab: Tab): boolean {
    const path = location.pathname;
    if (tab.to === "/tasks") {
      return (
        path === "/tasks" ||
        path.startsWith("/tasks/") ||
        path === "/goals" ||
        path.startsWith("/goals/")
      );
    }
    if (tab.matchPrefix) {
      return path === tab.to || path.startsWith(`${tab.matchPrefix}/`);
    }
    return path === tab.to;
  }

  function renderTab(tab: Tab) {
    const active = isActive(tab);
    return (
      <Link
        key={tab.to}
        to={tab.to}
        className={`app-tabbar__tab ${active ? "active" : ""}`}
      >
        <Icon
          name={tab.icon}
          size={20}
          color={active ? "#2E5BFF" : "#8395B3"}
          strokeWidth={2.2}
        />
        <span>{tab.label}</span>
      </Link>
    );
  }

  return (
    <>
      <nav className="app-tabbar" aria-label="Главное меню">
        <div className="app-tabbar__row">
          {TABS_LEFT.map(renderTab)}

          <button
            type="button"
            className="app-tabbar__plus"
            aria-label="Открыть AI-ввод"
            onClick={() => setAiOpen(true)}
          >
            <Icon name="plus" size={26} color="#fff" strokeWidth={2.6} />
          </button>

          {TABS_RIGHT.map(renderTab)}
        </div>
      </nav>

      <AiInputSheet open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
