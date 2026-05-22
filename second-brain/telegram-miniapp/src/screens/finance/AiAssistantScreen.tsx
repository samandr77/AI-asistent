import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";

import {
  analyzeFinanceEntry,
  chatWithFinanceAssistant,
  confirmFinanceEntry,
  getFinanceAnalytics,
  listFinanceRecommendations,
} from "../../services/api";
import type {
  FinanceAnalyzeEntryAction,
  FinanceChatResponse,
} from "../../types/api";
import { Icon } from "./components/Icon";
import { FinancePhone, Skeleton, centsToRub, fmt } from "./components/shell";

type ChatTurn =
  | { role: "user"; text: string; id: string }
  | { role: "ai"; response: FinanceChatResponse; id: string };

const QUICK_QUESTIONS = [
  "Куда я больше всего потратил в этом месяце?",
  "Какие подписки можно отключить?",
  "Сколько я в среднем трачу на еду?",
  "Как ускорить погашение долгов?",
];

export function AiAssistantScreen(): ReactNode {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingActions, setPendingActions] = useState<
    FinanceAnalyzeEntryAction[]
  >([]);
  const qc = useQueryClient();

  const analyticsQuery = useQuery({
    queryKey: ["finance", "analytics"],
    queryFn: () => getFinanceAnalytics(),
  });
  const recommendationsQuery = useQuery({
    queryKey: ["finance", "recommendations"],
    queryFn: listFinanceRecommendations,
  });

  const chat = useMutation({
    mutationFn: chatWithFinanceAssistant,
    onSuccess: (response) => {
      setTurns((prev) => [
        ...prev,
        { role: "ai", response, id: `ai-${Date.now()}` },
      ]);
    },
  });
  const analyze = useMutation({
    mutationFn: analyzeFinanceEntry,
    onSuccess: (response) => {
      setPendingActions(response.actions.filter((action) => action.kind !== "note"));
    },
  });
  const confirm = useMutation({
    mutationFn: confirmFinanceEntry,
    onSuccess: async () => {
      setPendingActions([]);
      await qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });

  const analytics = analyticsQuery.data;
  const recommendations = recommendationsQuery.data ?? [];
  const intro = recommendations[0];

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || chat.isPending) return;
    const id = `me-${Date.now()}`;
    setTurns((prev) => [...prev, { role: "user", text, id }]);
    setInput("");
    chat.mutate({ message: text });
  }

  function captureEntry() {
    const text = input.trim();
    if (!text || analyze.isPending) return;
    const id = `me-${Date.now()}`;
    setTurns((prev) => [...prev, { role: "user", text, id }]);
    setInput("");
    analyze.mutate({ text, currency: "RUB" });
  }

  function ask(question: string) {
    if (chat.isPending) return;
    setTurns((prev) => [
      ...prev,
      { role: "user", text: question, id: `me-${Date.now()}` },
    ]);
    chat.mutate({ message: question });
  }

  const cashFlow = centsToRub(analytics?.cash_flow_cents);
  const savingsRate =
    analytics && analytics.income_cents > 0
      ? Math.round(
          ((analytics.income_cents - analytics.expense_cents) /
            analytics.income_cents) *
            100,
        )
      : null;

  return (
    <FinancePhone title="Финансовый ассистент" activeTab="ai" backTo="/finance">
      <div className="red-head" style={{ paddingBottom: 24 }}>
        <div className="row gap" style={{ alignItems: "center" }}>
          <div className="ai-ava glass">ИИ</div>
          <div>
            <div style={{ fontWeight: 800 }}>Финик</div>
            <div className="small" style={{ opacity: 0.8 }}>
              ваш финансовый ассистент
            </div>
          </div>
          <div className="spacer" />
          <button type="button" className="ico dark" aria-label="Обновить">
            <Icon name="refresh" size={16} stroke="white" />
          </button>
        </div>
        <div
          className="card"
          style={{
            marginTop: 14,
            background: "rgba(255,255,255,.14)",
            boxShadow: "none",
            color: "white",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className="row gap">
            <Icon name="sparkles" size={16} stroke="white" />
            <div className="small" style={{ flex: 1 }}>
              {analyticsQuery.isLoading ? (
                <Skeleton height={16} />
              ) : analytics ? (
                <>
                  Кэш-флоу за период: <b>{fmt(cashFlow)} ₽</b>
                  {savingsRate !== null
                    ? ` · норма сбережения ${savingsRate}%`
                    : ""}
                  .
                </>
              ) : (
                <>Спросите ассистента про траты, бюджеты, подписки и цели.</>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="scroll" style={{ paddingBottom: 160 }}>
        <div className="chat-stream">
          {intro ? (
            <div className="chat-row">
              <div className="ava">ИИ</div>
              <div className="chat-msg ai">
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {intro.title}
                </div>
                <div>{intro.message}</div>
                {intro.suggested_action ? (
                  <div className="tiny mute" style={{ marginTop: 6 }}>
                    {intro.suggested_action}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="chat-row">
              <div className="ava">ИИ</div>
              <div className="chat-msg ai">
                Привет! Я помогу разобраться с тратами, бюджетами и
                накоплениями. Спросите что-нибудь — например, куда уходят
                деньги, или какие подписки можно отключить.
              </div>
            </div>
          )}

          {turns.map((turn) =>
            turn.role === "user" ? (
              <div className="chat-row me" key={turn.id}>
                <div className="chat-msg me">{turn.text}</div>
              </div>
            ) : (
              <div className="chat-row" key={turn.id}>
                <div className="ava">ИИ</div>
                <div className="chat-msg ai">
                  <div>{turn.response.answer}</div>
                  {turn.response.safety_note ? (
                    <div className="tiny mute" style={{ marginTop: 6 }}>
                      {turn.response.safety_note}
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}

          {pendingActions.length > 0 ? (
            <div className="chat-row">
              <div className="ava">ИИ</div>
              <div className="chat-msg ai">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  Нашёл финансовую запись
                </div>
                {pendingActions.map((action) => (
                  <div className="tiny mute" key={`${action.kind}-${action.reason}`}>
                    {action.kind} · {Math.round(action.confidence * 100)}% ·{" "}
                    {action.reason}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="sug"
                    onClick={() => confirm.mutate(pendingActions)}
                    disabled={confirm.isPending}
                  >
                    {confirm.isPending ? "Записываю…" : "Записать"}
                  </button>
                  <button
                    type="button"
                    className="sug"
                    onClick={() => setPendingActions([])}
                  >
                    Отменить
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {chat.isPending ? (
            <div className="chat-row">
              <div className="ava">ИИ</div>
              <div className="chat-msg ai">
                <Skeleton width={140} height={12} />
              </div>
            </div>
          ) : null}

          {chat.isError ? (
            <div className="chat-row">
              <div className="ava">ИИ</div>
              <div className="chat-msg ai" style={{ color: "var(--fin-red)" }}>
                Не получилось ответить. Проверьте подключение и попробуйте
                снова.
              </div>
            </div>
          ) : null}

          {turns.length === 0 ? (
            <div className="chat-row">
              <div className="ava">ИИ</div>
              <div className="chat-msg ai" style={{ padding: 12 }}>
                <div className="tiny mute" style={{ marginBottom: 6 }}>
                  предлагаю спросить:
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      type="button"
                      className="sug"
                      key={q}
                      onClick={() => ask(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div
            className="tiny mute"
            style={{ alignSelf: "center", textAlign: "center", marginTop: 12 }}
          >
            Ассистент даёт ориентиры по вашим данным, а не профессиональные
            финансовые, юридические или налоговые консультации.
          </div>
        </div>
      </div>

      <form className="input-bar" onSubmit={submit}>
        <Icon name="paperclip" size={16} stroke="var(--fin-mute)" />
        <input
          type="text"
          placeholder="Напишите или скажите..."
          aria-label="Сообщение ассистенту"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={chat.isPending}
        />
        <button type="button" className="mic" aria-label="Голосовой ввод">
          <Icon name="mic" size={16} />
        </button>
        <button
          type="button"
          className="mic"
          aria-label="Разобрать как операцию"
          onClick={captureEntry}
          disabled={analyze.isPending || !input.trim()}
        >
          <Icon name="check" size={16} />
        </button>
        <button
          type="submit"
          className="send"
          aria-label="Отправить"
          disabled={chat.isPending || !input.trim()}
        >
          <Icon name="send" size={14} stroke="white" />
        </button>
      </form>
    </FinancePhone>
  );
}
