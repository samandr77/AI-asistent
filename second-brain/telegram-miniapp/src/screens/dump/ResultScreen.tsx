import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { TaskCard } from "../../components/TaskCard";
import { getDumpResult } from "../../services/api";
import type { DumpTextResponse, DumpVoiceResponse } from "../../types/api";

interface ResultLocationState {
  result?: DumpTextResponse | DumpVoiceResponse;
}

export function ResultScreen() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as ResultLocationState | null;
  const dumpId = searchParams.get("dump_id");
  const resultQuery = useQuery({
    queryKey: ["dump-result", dumpId],
    queryFn: () => getDumpResult(dumpId ?? ""),
    enabled: !state?.result && Boolean(dumpId),
  });
  const result = state?.result ?? resultQuery.data;
  const transcription =
    result && "transcription" in result && typeof result.transcription === "string"
      ? result.transcription
      : null;

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.result")}</h1>
        {resultQuery.isLoading ? (
          <p className="muted">{t("common.loading")}</p>
        ) : null}
        {result ? (
          <>
            {transcription ? (
              <div className="status">
                <strong>{t("result.transcription")}</strong>
                <p className="muted">{transcription}</p>
              </div>
            ) : null}
            <div className="task-list">
              {result.tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </>
        ) : !resultQuery.isLoading ? (
          <p className="muted">{t("result.missing")}</p>
        ) : null}
        <Link className="button secondary" to="/today">
          {t("common.today")}
        </Link>
      </section>
    </main>
  );
}
