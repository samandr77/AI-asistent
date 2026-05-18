import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { GoalCard } from "../../components/GoalCard";
import { listGoals } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Goal } from "../../types/api";

const statuses: Goal["status"][] = ["active", "paused", "achieved", "archived"];

export function GoalsScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Goal["status"]>("active");
  const setGoals = useAppStore((state) => state.setGoals);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["goals", status],
    queryFn: () => listGoals({ status }),
  });

  useEffect(() => {
    if (data) setGoals(data);
  }, [data, setGoals]);

  return (
    <main className="screen">
      <section className="panel stack">
        <div className="header-row">
          <div>
            <p className="eyebrow">{t("app.name")}</p>
            <h1>{t("screens.goals")}</h1>
          </div>
          <Link className="button" to="/goals/new">
            {t("goals.add")}
          </Link>
        </div>
        <div className="segmented" role="tablist" aria-label="Goal status">
          {statuses.map((item) => (
            <button
              className={status === item ? "active" : ""}
              key={item}
              type="button"
              onClick={() => setStatus(item)}
            >
              {t(`goals.status.${item}`)}
            </button>
          ))}
        </div>
        {isLoading ? <p className="muted">{t("common.loading")}</p> : null}
        {error ? (
          <button className="button secondary" type="button" onClick={() => void refetch()}>
            {t("common.retry")}
          </button>
        ) : null}
        {data && data.length === 0 ? (
          <p className="muted">{t("goals.empty")}</p>
        ) : null}
        <div className="goal-list">
          {data?.map((goal) => <GoalCard goal={goal} key={goal.id} />)}
        </div>
      </section>
    </main>
  );
}
