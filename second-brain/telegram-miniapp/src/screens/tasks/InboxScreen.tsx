import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { getInboxTasks, processTask } from "../../services/api";
import type { Task, TaskProcessAction } from "../../types/api";

import { Icon } from "./components/Icon";
import {
  AIChip,
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  TabBar,
  TasksApp,
  TopBar,
} from "./components/shell";

interface InboxCardProps {
  task: Task;
  onAction: (id: string, action: TaskProcessAction) => void;
  pending: boolean;
  alreadyNotice: string | null;
}

function InboxCard({ task, onAction, pending, alreadyNotice }: InboxCardProps) {
  const { t } = useTranslation();
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateName, setDelegateName] = useState("");

  const createdAt = task.deadline ?? "";
  const sourceLabel = task.raw_text ? "Быстрый ввод" : "Без исходного текста";

  return (
    <article className="inbox-item">
      <Link
        to={`/tasks/${task.id}`}
        state={{ task }}
        className="head"
        style={{ display: "block", textDecoration: "none", color: "inherit" }}
      >
        <div className="src">
          <Icon name="plus" size={13} color="var(--ink-500)" strokeWidth={2} />
          {sourceLabel}
          {createdAt
            ? ` · ${new Date(createdAt).toLocaleDateString("ru-RU")}`
            : null}
        </div>
        <h2
          style={{
            margin: 0,
            marginTop: 8,
            fontSize: 15,
            fontWeight: 700,
            color: "var(--ink-900)",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {task.title}
        </h2>
        {task.raw_text ? <div className="raw">«{task.raw_text}»</div> : null}
      </Link>

      <div className="ai-strip">
        <div className="label">
          <Icon name="sparkle" size={12} color="var(--accent)" /> AI предлагает
        </div>
        <div className="row">
          {task.deadline ? (
            <span className="chip">
              <Icon
                name="calendar"
                size={10}
                color="var(--ink-500)"
                strokeWidth={2}
              />
              {new Date(task.deadline).toLocaleDateString("ru-RU")}
            </span>
          ) : null}
          {task.sphere ? (
            <span className="chip">
              <Icon
                name="folder"
                size={10}
                color="var(--ink-500)"
                strokeWidth={2}
              />
              {task.sphere}
            </span>
          ) : null}
          <span className="chip">
            <Icon
              name="flag"
              size={10}
              color="var(--ink-500)"
              strokeWidth={2}
            />
            {task.priority === 1
              ? "Высокий"
              : task.priority === 2
                ? "Средний"
                : "Низкий"}
          </span>
        </div>
      </div>

      <div className="actions">
        <button
          className="btn primary tiny"
          type="button"
          disabled={pending}
          onClick={() =>
            onAction(task.id, { action: "schedule", is_today: true })
          }
        >
          {t("tasks.inbox.process.scheduleToday")}
        </button>
        <button
          className="btn tiny"
          type="button"
          disabled={pending}
          onClick={() => onAction(task.id, { action: "schedule" })}
        >
          {t("tasks.inbox.process.scheduleLater")}
        </button>
        <button
          className="btn tiny"
          type="button"
          disabled={pending}
          onClick={() => setDelegateOpen((v) => !v)}
        >
          {t("tasks.inbox.process.delegate")}
        </button>
        <button
          className="btn tiny"
          type="button"
          disabled={pending}
          onClick={() => onAction(task.id, { action: "convert_project" })}
        >
          {t("tasks.inbox.process.convertProject")}
        </button>
        <button
          className="btn ghost tiny"
          type="button"
          disabled={pending}
          onClick={() => onAction(task.id, { action: "delete" })}
        >
          {t("tasks.inbox.process.delete")}
        </button>
      </div>

      {delegateOpen ? (
        <div style={{ padding: "0 12px 12px", display: "flex", gap: 6 }}>
          <input
            type="text"
            value={delegateName}
            onChange={(e) => setDelegateName(e.target.value)}
            placeholder={t("tasks.inbox.delegateToPlaceholder")}
            aria-label={t("tasks.inbox.delegateToPlaceholder")}
            disabled={pending}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--hairline-strong)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            className="btn primary tiny"
            type="button"
            disabled={pending}
            onClick={() => {
              onAction(task.id, {
                action: "delegate",
                delegate_to: delegateName.trim() || undefined,
              });
              setDelegateOpen(false);
              setDelegateName("");
            }}
          >
            OK
          </button>
        </div>
      ) : null}

      {alreadyNotice ? (
        <div
          style={{
            padding: "0 16px 12px",
            fontSize: 11.5,
            color: "var(--ink-400)",
          }}
        >
          {alreadyNotice}
        </div>
      ) : null}
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

  const count = data?.length ?? 0;

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={<IconBtn name="filter" variant="on-card" ariaLabel="Фильтр" />}
          eyebrow="Обработка входящих"
          title={t("tasks.inbox.title")}
          subtitle={t("tasks.inbox.subtitle")}
        />

        <ScreenBody>
          {count > 0 ? (
            <AIChip
              text={
                <>
                  В Inbox{" "}
                  <b>
                    {count} {count === 1 ? "задача" : "задач"}
                  </b>
                  . Запустить быструю обработку?
                </>
              }
              cta="Запустить"
            />
          ) : null}

          {isLoading ? (
            <div className="empty-state">{t("common.loading")}</div>
          ) : null}
          {error ? (
            <button
              className="btn ghost"
              type="button"
              onClick={() => void refetch()}
            >
              {t("common.retry")}
            </button>
          ) : null}
          {data && data.length === 0 && !isLoading ? (
            <div className="empty-state">{t("tasks.inbox.empty")}</div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

          {data && data.length > 0 ? (
            <div
              style={{
                marginTop: 4,
                textAlign: "center",
                fontSize: 11.5,
                color: "var(--ink-400)",
                fontWeight: 500,
                padding: "8px 0 4px",
              }}
            >
              Метод Inbox Zero · Merlin Mann
            </div>
          ) : null}
        </ScreenBody>

        <TabBar active="tasks" />
      </Screen>
    </TasksApp>
  );
}
