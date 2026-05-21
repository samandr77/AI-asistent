import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "./components/Icon";
import {
  BackBtn,
  IconBtn,
  Screen,
  ScreenBody,
  SPHERES,
  TasksApp,
  TopBar,
  type TaskSphere,
} from "./components/shell";

type Msg =
  | {
      from: "ai";
      text: string;
      suggestions?: { name: string; sphere: TaskSphere }[];
    }
  | { from: "me"; text: string };

const SAMPLE: Msg[] = [
  {
    from: "ai",
    text: "Привет! Опишите задачи или цели — помогу спланировать день.",
  },
];

const PROMPTS = [
  "Спланируй мою пятницу",
  "Какие задачи я откладываю?",
  "Разбей большую задачу",
  "Сделай weekly review",
];

export function AIChatScreen() {
  const [draft, setDraft] = useState("");
  const navigate = useNavigate();

  return (
    <TasksApp>
      <Screen>
        <TopBar
          left={<BackBtn to="/tasks" />}
          right={<IconBtn name="more" variant="on-card" ariaLabel="Ещё" />}
          title={
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
            >
              <span
                className="ai-dot"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  fontSize: 12,
                  background: "linear-gradient(135deg, var(--accent), #0ea5e9)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                }}
              >
                AI
              </span>
              AI-помощник
            </span>
          }
          subtitle="Помнит ваши проекты, привычки и пиковое время"
        />

        <ScreenBody style={{ paddingTop: 6, paddingBottom: 160 }}>
          {SAMPLE.map((m, i) =>
            m.from === "ai" ? (
              <div key={i} className="ai-msg">
                <div className="ai-dot">AI</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div className="bubble">{m.text}</div>
                  {m.suggestions ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {m.suggestions.map((s) => (
                        <div key={s.name} className="ai-suggestion">
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 5,
                              background: SPHERES[s.sphere].color,
                              opacity: 0.18,
                              border: `1.5px solid ${SPHERES[s.sphere].color}`,
                            }}
                          />
                          <div
                            style={{
                              flex: 1,
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: "var(--ink-800)",
                            }}
                          >
                            {s.name}
                          </div>
                          <Icon
                            name="plus"
                            size={14}
                            color="var(--accent)"
                            strokeWidth={2.2}
                          />
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button
                          type="button"
                          className="btn primary tiny"
                          onClick={() => navigate("/tasks")}
                        >
                          Добавить все
                        </button>
                        <button type="button" className="btn ghost tiny">
                          Отредактировать
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key={i} className="me-msg">
                <div className="bubble">{m.text}</div>
              </div>
            ),
          )}

          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingTop: 6,
            }}
          >
            {PROMPTS.map((p) => (
              <div key={p} className="prompt-chip">
                <Icon name="sparkle" size={11} color="var(--accent)" /> {p}
              </div>
            ))}
          </div>
        </ScreenBody>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            setDraft("");
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Напишите задачу или вопрос…"
            aria-label="Сообщение AI"
          />
          <button type="button" className="icon-btn" aria-label="Голос">
            <Icon name="mic" size={16} color="var(--ink-700)" />
          </button>
          <button
            type="submit"
            className="icon-btn"
            style={{ background: "var(--accent)", color: "#fff" }}
            disabled={!draft.trim()}
            aria-label="Отправить"
          >
            <Icon name="send" size={16} color="#fff" />
          </button>
        </form>
      </Screen>
    </TasksApp>
  );
}
