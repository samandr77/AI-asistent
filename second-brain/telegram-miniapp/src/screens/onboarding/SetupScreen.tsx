import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { updateProfile } from "../../services/api";
import { markOnboardingComplete } from "../../services/onboarding";

type DemoResult = {
  label: string;
  text: string;
};

const defaultDemoText =
  "Завтра оплатить подписку, купить продукты и отложить 10000 на подушку";

function analyzeDemo(text: string): DemoResult[] {
  const normalized = text.toLowerCase();
  const results: DemoResult[] = [];

  if (
    normalized.includes("оплат") ||
    normalized.includes("куп") ||
    normalized.includes("подпис") ||
    normalized.includes("руб") ||
    normalized.includes("₽")
  ) {
    results.push({
      label: "Финансы",
      text: "Записать расход, подписку или финансовое событие.",
    });
  }

  if (
    normalized.includes("завтра") ||
    normalized.includes("сдел") ||
    normalized.includes("позвон") ||
    normalized.includes("куп")
  ) {
    results.push({
      label: "Задачи",
      text: "Создать действие и поставить его в план дня.",
    });
  }

  if (
    normalized.includes("отлож") ||
    normalized.includes("цель") ||
    normalized.includes("подуш")
  ) {
    results.push({
      label: "Цели",
      text: "Связать запись с накоплением или долгосрочной целью.",
    });
  }

  results.push({
    label: "Память",
    text: "Сохранить важный контекст для будущих подсказок.",
  });

  return results;
}

export function SetupScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [demoText, setDemoText] = useState(defaultDemoText);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const demoResults = useMemo(() => analyzeDemo(demoText), [demoText]);

  const finishMutation = useMutation({
    mutationFn: (targetPath: string) =>
      updateProfile({ is_onboarded: true, language: "ru" }).then(() => targetPath),
    onSettled: (_data, _error, targetPath) => {
      markOnboardingComplete();
      navigate(targetPath || "/today", { replace: true });
    },
  });

  const canGoNext = step !== 3 || hasAnalyzed;

  return (
    <main className="screen onboarding-screen">
      <section className="panel stack">
        {step === 0 ? (
          <div className="onboarding-hero welcome-panel" aria-label="Экран приветствия">
            <div className="onboarding-visual welcome-visual" aria-hidden="true">
              <div className="visual-card visual-card-main">
                <span>Мысль</span>
                <strong>Анализ</strong>
              </div>
              <div className="visual-card visual-card-task">Задачи</div>
              <div className="visual-card visual-card-finance">Финансы</div>
              <div className="visual-card visual-card-goal">Цели</div>
            </div>
            <p className="eyebrow">Второй мозг</p>
            <h1>Твой личный центр управления</h1>
            <p className="muted">
              Сначала просто записывай мысли. Дальше приложение поможет понять,
              что с ними делать.
            </p>
            <button className="button" type="button" onClick={() => setStep(1)}>
              Начать
            </button>
          </div>
        ) : null}

        {step > 0 ? (
          <div className="onboarding-visual">
            <div className="visual-card visual-card-main">
              <span>Мысль</span>
              <strong>Анализ</strong>
            </div>
            <div className="visual-card visual-card-task">Задачи</div>
            <div className="visual-card visual-card-finance">Финансы</div>
            <div className="visual-card visual-card-goal">Цели</div>
          </div>
        ) : null}

        {step > 0 ? (
          <div className="onboarding-progress" aria-label="Прогресс знакомства">
            {[1, 2, 3, 4].map((item) => (
              <span className={item <= step ? "active" : ""} key={item} />
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <section className="status stack">
            <h2 className="section-title">Что это за приложение</h2>
            <p>
              Это помощник, который собирает твои мысли, задачи, планы, деньги,
              цели и рефлексию в одном месте.
            </p>
            <p>
              Не нужно сразу думать, куда что записывать. Сначала просто
              фиксируешь мысль, потом запускаешь анализ.
            </p>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="status stack">
            <h2 className="section-title">Как оно работает</h2>
            <div className="onboarding-list">
              <span>1. Ты пишешь или надиктовываешь мысль.</span>
              <span>2. Нажимаешь “Анализ”.</span>
              <span>3. Система понимает, что это: задача, финансы, цель или заметка.</span>
              <span>4. Потом ты проверяешь результат и ведёшь день из экрана “Сегодня”.</span>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="status stack">
            <h2 className="section-title">Попробуй сам</h2>
            <p className="muted">
              Измени пример или оставь как есть, затем нажми “Анализ”.
            </p>
            <textarea
              className="dump-input small"
              value={demoText}
              onChange={(event) => {
                setDemoText(event.target.value);
                setHasAnalyzed(false);
              }}
            />
            <button
              className="button"
              disabled={!demoText.trim()}
              type="button"
              onClick={() => setHasAnalyzed(true)}
            >
              Анализ
            </button>
            {hasAnalyzed ? (
              <div className="onboarding-results">
                {demoResults.map((result) => (
                  <div className="finance-card" key={result.label}>
                    <div>
                      <strong>{result.label}</strong>
                      <span>{result.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="status stack">
            <h2 className="section-title">Теперь попробуй в реальном разделе</h2>
            <p>
              Начни с записи мысли или открой финансы. Эти кнопки останутся
              доступными на главном экране.
            </p>
            <div className="action-row">
              <button
                className="button secondary"
                type="button"
                onClick={() => finishMutation.mutate("/dump")}
              >
                Записать мысль
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => finishMutation.mutate("/finance")}
              >
                Открыть финансы
              </button>
            </div>
          </section>
        ) : null}

        {step > 0 ? (
          <div className="action-row">
          {step > 0 ? (
            <button className="button secondary" type="button" onClick={() => setStep(step - 1)}>
              Назад
            </button>
          ) : null}
          {step < 4 ? (
            <button
              className="button"
              disabled={!canGoNext}
              type="button"
              onClick={() => setStep(step + 1)}
            >
              Далее
            </button>
          ) : (
            <button
              className="button"
              disabled={finishMutation.isPending}
              type="button"
              onClick={() => finishMutation.mutate("/today")}
            >
              {finishMutation.isPending ? "Сохраняю..." : "Начать пользоваться"}
            </button>
          )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
