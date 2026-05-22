import { Link } from "react-router-dom";

import { Icon, type TaskIconName } from "./components/Icon";
import {
  BackBtn,
  Screen,
  ScreenBody,
  TabBar,
  TasksApp,
  TopBar,
} from "./components/shell";

interface HubCard {
  to: string;
  name: string;
  sub: string;
  icon: TaskIconName;
  color: string;
}

const CARDS: HubCard[] = [
  {
    to: "/goals",
    name: "Цели",
    sub: "OKR · стратегия · KPI · ревью",
    icon: "target",
    color: "#6E5BF6",
  },
  {
    to: "/tasks/big-three",
    name: "Big Three",
    sub: "Три главные задачи дня",
    icon: "target",
    color: "var(--accent)",
  },
  {
    to: "/tasks/matrix",
    name: "Матрица Эйзенхауэра",
    sub: "Срочно × Важно",
    icon: "grid",
    color: "var(--danger)",
  },
  {
    to: "/tasks/timeblock",
    name: "Тайм-блокинг",
    sub: "День по Кэлу Ньюпорту",
    icon: "calendar",
    color: "var(--focus)",
  },
  {
    to: "/tasks/focus",
    name: "Pomodoro",
    sub: "25 / 5 фокус-сессии",
    icon: "play",
    color: "var(--accent-strong)",
  },
  {
    to: "/tasks/projects",
    name: "Проекты",
    sub: "PARA · Tiago Forte",
    icon: "folder",
    color: "var(--sphere-personal)",
  },
  {
    to: "/tasks/habits",
    name: "Привычки",
    sub: "Стрики и регулярность",
    icon: "fire",
    color: "var(--warn)",
  },
  {
    to: "/tasks/contexts",
    name: "Контексты",
    sub: "GTD · @места, фильтры",
    icon: "location",
    color: "var(--sphere-mind)",
  },
  {
    to: "/tasks/analytics",
    name: "Аналитика",
    sub: "Прогресс, сроки, инсайты",
    icon: "chart",
    color: "var(--success)",
  },
  {
    to: "/tasks/ai",
    name: "AI-помощник",
    sub: "Планирование диалогом",
    icon: "sparkle",
    color: "var(--accent)",
  },
  {
    to: "/tasks/inbox",
    name: "Inbox",
    sub: "Обработка входящих",
    icon: "inbox",
    color: "var(--accent)",
  },
];

export function TasksMoreScreen() {
  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          eyebrow="Все разделы"
          title="Задачи"
          subtitle="12 методов и инструментов под одной обложкой"
        />
        <ScreenBody>
          <div className="hub-grid">
            {CARDS.map((c) => (
              <Link key={c.to} to={c.to} className="hub-card">
                <div
                  className="ico"
                  style={{ background: `${c.color}1A`, color: c.color }}
                >
                  <Icon
                    name={c.icon}
                    size={18}
                    color={c.color}
                    strokeWidth={2}
                  />
                </div>
                <div>
                  <div className="name">{c.name}</div>
                  <div className="sub">{c.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </ScreenBody>
        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
