import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getInboxTasks, processTask } from "../../services/api";
import type { Task, TaskProcessAction } from "../../types/api";

interface InboxCardProps {
  task: Task;
  onAction: (id: string, action: TaskProcessAction) => void;
  pending: boolean;
  alreadyNotice: string | null;
}

function InboxCard({ task, onAction, pending, alreadyNotice }: InboxCardProps) {
  const { t } = useTranslation();
  const [delegateName, setDelegateName] = useState("");

  return (
    <article className="task-card task-card--inbox">
      <Link
        className="task-card__body"
        to={`/tasks/${task.id}`}
        state={{ task }}
      >
        <h2>{task.title}</h2>
        {task.raw_text ? (
          <p className="muted">
            <strong>{t("tasks.inbox.originalLabel")}</strong> {task.raw_text}
          </p>
        ) : null}
      </Link>
      <div className="action-row">
        <button
          className="button"
          type="button"
          disabled={pending}
          onClick={() =>
            onAction(task.id, { action: "schedule", is_today: true })
          }
        >
          {t("tasks.inbox.process.scheduleToday")}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={() => onAction(task.id, { action: "schedule" })}
        >
          {t("tasks.inbox.process.scheduleLater")}
        </button>
        <input
          type="text"
          value={delegateName}
          onChange={(e) => setDelegateName(e.target.value)}
          placeholder={t("tasks.inbox.delegateToPlaceholder")}
          aria-label={t("tasks.inbox.delegateToPlaceholder")}
          disabled={pending}
        />
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            onAction(task.id, {
              action: "delegate",
              delegate_to: delegateName.trim() || undefined,
            })
          }
        >
          {t("tasks.inbox.process.delegate")}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={() => onAction(task.id, { action: "convert_project" })}
        >
          {t("tasks.inbox.process.convertProject")}
        </button>
        <button
          className="button danger"
          type="button"
          disabled={pending}
          onClick={() => onAction(task.id, { action: "delete" })}
        >
          {t("tasks.inbox.process.delete")}
        </button>
      </div>
      {alreadyNotice ? <p className="muted">{alreadyNotice}</p> : null}
    </article>
  );
}

export function InboxScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [alreadyNotice, setAlreadyNotice] = useState<string | null>(null);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["tasks", "inbox"],
    queryFn: () => getInboxTasks(),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: TaskProcessAction }) =>
      processTask(id, action),
    onSuccess: (response) => {
      if (response?.already_processed) {
        setAlreadyNotice(t("tasks.inbox.alreadyProcessed"));
      } else {
        setAlreadyNotice(null);
      }
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  function handleAction(id: string, action: TaskProcessAction) {
    setAlreadyNotice(null);
    mutation.mutate({ id, action });
  }

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("tasks.inbox.title")}</h1>
        <p className="muted">{t("tasks.inbox.subtitle")}</p>

        {isLoading ? <p className="muted">{t("common.loading")}</p> : null}
        {error ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => void refetch()}
          >
            {t("common.retry")}
          </button>
        ) : null}
        {data && data.length === 0 ? (
          <p className="muted">{t("tasks.inbox.empty")}</p>
        ) : null}
        <div className="task-list">
          {data?.map((task) => (
            <InboxCard
              key={task.id}
              task={task}
              onAction={handleAction}
              pending={mutation.isPending}
              alreadyNotice={alreadyNotice}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
