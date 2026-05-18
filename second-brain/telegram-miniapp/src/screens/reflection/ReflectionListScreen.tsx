import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getReflectionStats, listReflections } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ReflectionListScreen() {
  const { t } = useTranslation();
  const setReflections = useAppStore((state) => state.setReflections);
  const reflectionsQuery = useQuery({
    queryKey: ["reflections"],
    queryFn: () => listReflections({ limit: 30 }),
  });
  const statsQuery = useQuery({
    queryKey: ["reflections", "stats"],
    queryFn: getReflectionStats,
  });

  useEffect(() => {
    if (reflectionsQuery.data) {
      setReflections(reflectionsQuery.data);
    }
  }, [reflectionsQuery.data, setReflections]);

  const today = toLocalDateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toLocalDateString(yesterdayDate);
  const reflections = reflectionsQuery.data ?? [];
  const hasToday = reflections.some((reflection) => reflection.date === today);
  const hasYesterday = reflections.some(
    (reflection) => reflection.date === yesterday,
  );
  const showBackfill = reflections.length > 0 && !hasToday && !hasYesterday;

  return (
    <main className="screen">
      <section className="panel stack">
        <div className="header-row">
          <div>
            <p className="eyebrow">{t("app.name")}</p>
            <h1>{t("screens.reflectionList")}</h1>
          </div>
          <Link className="button" to="/reflections/today">
            {t("reflection.today")}
          </Link>
        </div>
        {statsQuery.data ? (
          <p className="status">
            {t("reflection.streak", {
              count: statsQuery.data.current_streak,
              total: statsQuery.data.total_reflections,
            })}
          </p>
        ) : null}
        {showBackfill ? (
          <Link
            className="backfill-banner"
            to={`/reflections/today?date=${yesterday}`}
          >
            <strong>{t("reflection.addYesterday")}</strong>
            <span>{t("reflection.addYesterdayHint")}</span>
          </Link>
        ) : null}
        {reflectionsQuery.isLoading ? (
          <p className="muted">{t("common.loading")}</p>
        ) : null}
        {reflectionsQuery.data?.length === 0 ? (
          <p className="muted">{t("reflection.empty")}</p>
        ) : null}
        <div className="list">
          {reflectionsQuery.data?.map((reflection) => (
            <Link
              className="row-link"
              key={reflection.id}
              to={`/reflections/${reflection.date}`}
              state={{ reflection }}
            >
              <strong>{reflection.date}</strong>
              <span>
                {t("reflection.moodEnergy", {
                  mood: reflection.mood,
                  energy: reflection.energy,
                })}
                {reflection.goal_aligned_count > 0
                  ? ` · ${t("reflection.goalAlignedShort", {
                      count: reflection.goal_aligned_count,
                    })}`
                  : ""}
              </span>
              {reflection.notes ? (
                <span className="row-note">{reflection.notes}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
