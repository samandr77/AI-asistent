import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { deleteReflection, getReflectionByDate } from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import type { Reflection } from "../../types/api";

interface ReflectionDetailState {
  reflection?: Reflection;
}

export function ReflectionDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { date } = useParams();
  const state = location.state as ReflectionDetailState | null;
  const removeReflection = useAppStore((store) => store.removeReflectionFromStore);
  const query = useQuery({
    queryKey: ["reflections", date],
    queryFn: () => getReflectionByDate(date ?? ""),
    enabled: !state?.reflection && Boolean(date),
  });
  const reflection = state?.reflection ?? query.data ?? null;
  const deleteMutation = useMutation({
    mutationFn: () => deleteReflection(reflection?.id ?? ""),
    onSuccess: () => {
      if (reflection) removeReflection(reflection.id);
      navigate("/reflections", { replace: true });
    },
  });

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{date ?? t("screens.reflectionDetail")}</h1>
        {!reflection ? (
          <p className="muted">{t("reflection.notFound")}</p>
        ) : (
          <>
            <p className="status">
              {t("reflection.moodEnergy", {
                mood: reflection.mood,
                energy: reflection.energy,
              })}
            </p>
            <p className="muted">
              {t("reflection.detailCounts", {
                completed: reflection.completed_count,
                aligned: reflection.goal_aligned_count,
              })}
            </p>
            {reflection.notes ? <p className="status">{reflection.notes}</p> : null}
            <div className="action-row">
              <Link className="button secondary" to="/reflections/today">
                {t("common.save")}
              </Link>
              <button
                className="button danger"
                disabled={deleteMutation.isPending}
                type="button"
                onClick={() => deleteMutation.mutate()}
              >
                {t("common.delete")}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
