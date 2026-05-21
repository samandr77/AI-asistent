import { Link } from "react-router-dom";

import { Icon, type TaskIconName } from "../tasks/components/Icon";
import { GoalsBody, GoalsScreenLayout, GoalsTopBar } from "./components/shell";

const TILES: {
  to: string;
  icon: TaskIconName;
  title: string;
  sub: string;
}[] = [
  {
    to: "/goals",
    icon: "target",
    title: "OKR-дерево",
    sub: "Жизнь → Год → Квартал → Неделя",
  },
  {
    to: "/goals/strategy",
    icon: "sparkle",
    title: "Стратегия",
    sub: "Mission, vision, ценности, SWOT",
  },
  {
    to: "/goals/kpi",
    icon: "chart",
    title: "KPI",
    sub: "5–20 метрик с трендами",
  },
  {
    to: "/goals/review",
    icon: "trend",
    title: "Ревью недели",
    sub: "Итоги недели и фокус на следующую",
  },
  {
    to: "/goals/new",
    icon: "plus",
    title: "Новая цель",
    sub: "Создать цель с уровнем и весом",
  },
];

export function GoalsMoreScreen() {
  return (
    <GoalsScreenLayout>
      <GoalsTopBar
        back="/goals"
        title="Ещё · Цели"
        eyebrow="Навигация раздела"
      />
      <GoalsBody>
        <div className="g-tile-grid">
          {TILES.map((t) => (
            <Link key={t.to} to={t.to} className="g-tile">
              <div className="g-tile__icon">
                <Icon
                  name={t.icon}
                  size={16}
                  color="#6E5BF6"
                  strokeWidth={2.2}
                />
              </div>
              <div className="g-tile__title">{t.title}</div>
              <div className="g-tile__sub">{t.sub}</div>
            </Link>
          ))}
        </div>
      </GoalsBody>
    </GoalsScreenLayout>
  );
}
