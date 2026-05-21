import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { Icon, type TaskIconName } from "../tasks/components/Icon";
import {
  getFinanceDashboard,
  getInboxTasks,
  getTodaySummary,
  getTodayTasks,
  listGoals,
} from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import { useSessionStore } from "../../store/useSessionStore";

const SPHERE = {
  work: { color: "#2E5BFF", tint: "#E2EAFF" },
  finance: { color: "#E04F5F", tint: "#FBE1E4" },
  health: { color: "#1FA67A", tint: "#D6F0E3" },
  mind: { color: "#6E5BF6", tint: "#E5DEFB" },
  personal: { color: "#DC8A1E", tint: "#FBEAD0" },
} as const;

type SphereKey = keyof typeof SPHERE;

const WEEKDAYS = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
];

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function formatRub(cents: number): string {
  const rub = Math.round(cents / 100);
  const sign = rub < 0 ? "−" : "";
  const abs = Math.abs(rub);
  const grouped = abs.toLocaleString("ru-RU");
  return `${sign}${grouped} ₽`;
}

function formatToday(date: Date): string {
  const dow = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${dow}, ${day} ${month}`;
}

function formatHeroDate(date: Date): string {
  return `Сегодня · ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function TodayScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setTodayTasks = useAppStore((state) => state.setTodayTasks);
  const pendingTextDumps = useAppStore((state) => state.pendingTextDumps);
  const user = useSessionStore((state) => state.user);

  const todayTasks = useQuery({
    queryKey: ["tasks", "today"],
    queryFn: getTodayTasks,
  });

  const inboxTasks = useQuery({
    queryKey: ["tasks", "inbox"],
    queryFn: () => getInboxTasks(),
  });

  const goals = useQuery({
    queryKey: ["goals", "list", "active"],
    queryFn: () => listGoals({ status: "active" }),
  });

  const finance = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: getFinanceDashboard,
  });

  const reflection = useQuery({
    queryKey: ["reflections", "today-summary"],
    queryFn: () => getTodaySummary(),
  });

  useEffect(() => {
    if (todayTasks.data) {
      setTodayTasks(todayTasks.data);
    }
  }, [todayTasks.data, setTodayTasks]);

  const now = useMemo(() => new Date(), []);

  const tasks = todayTasks.data ?? [];
  const totalToday = tasks.length;
  const doneToday = tasks.filter((task) => task.is_done).length;
  const bigThree = tasks.filter(
    (task) => (task.priority ?? 4) <= 1 && !task.is_done,
  ).length;
  const progress =
    totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
  const ringDash = (2 * Math.PI * 24 * progress) / 100;
  const ringTotal = 2 * Math.PI * 24;

  const hero = {
    label: "Задачи",
    when: formatHeroDate(now),
    kpis: [
      { l: "Big 3", v: bigThree > 0 ? `${bigThree}` : "—" },
      { l: "Inbox", v: `${inboxTasks.data?.length ?? 0}` },
      { l: "Готово", v: `${doneToday}` },
      { l: "Всего", v: `${totalToday}` },
    ],
  };

  const financeStat = finance.data
    ? finance.data.monthly_expense_cents > 0
      ? formatRub(-finance.data.monthly_expense_cents)
      : "0 ₽"
    : "—";
  const financeSub = finance.data
    ? `Бюджет · остаток ${finance.data.remaining_budget_cents != null ? formatRub(finance.data.remaining_budget_cents) : "—"}`
    : "Подключи финансы";

  const activeGoals = goals.data ?? [];
  const goalsAvg =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce((sum, g) => sum + (g.progress_percent ?? 0), 0) /
            activeGoals.length,
        )
      : 0;
  const goalsTop = activeGoals
    .slice()
    .sort((a, b) => (b.progress_percent ?? 0) - (a.progress_percent ?? 0))[0];

  const sections: Array<{
    id: string;
    to: string;
    sphere: SphereKey;
    label: string;
    kicker: string;
    stat: string;
    sub: string;
    icon: TaskIconName;
  }> = [
    {
      id: "finance",
      to: "/finance",
      sphere: "finance",
      label: "Финансы",
      kicker: "За месяц",
      stat: financeStat,
      sub: financeSub,
      icon: "chart",
    },
    {
      id: "health",
      to: "/today",
      sphere: "health",
      label: "Здоровье",
      kicker: "Раздел",
      stat: "—",
      sub: "Скоро · подключим источники",
      icon: "fire",
    },
    {
      id: "goals",
      to: "/goals",
      sphere: "mind",
      label: "Цели",
      kicker: `${activeGoals.length} активных`,
      stat: activeGoals.length > 0 ? `${goalsAvg}%` : "—",
      sub: goalsTop
        ? `${goalsTop.title} → ${goalsTop.progress_percent ?? 0}%`
        : "Поставь первую цель",
      icon: "target",
    },
    {
      id: "journal",
      to: "/reflections/today",
      sphere: "personal",
      label: "Дневник",
      kicker: "Сегодня",
      stat: reflection.data?.existing_reflection ? "Готово" : "—",
      sub: reflection.data?.existing_reflection
        ? `Настроение ${reflection.data.existing_reflection.mood}/10 · Энергия ${reflection.data.existing_reflection.energy}/10`
        : "Запиши вечернюю рефлексию",
      icon: "sparkle",
    },
  ];

  const recs = useMemo(() => {
    const list: Array<{
      icon: TaskIconName;
      title: string;
      sub: string;
      tone: SphereKey;
      to: string;
    }> = [];

    if ((inboxTasks.data?.length ?? 0) > 0) {
      list.push({
        icon: "inbox",
        title: "Инбокс ждёт",
        sub: `${inboxTasks.data?.length} новых · обработать`,
        tone: "work",
        to: "/tasks/inbox",
      });
    }

    if (bigThree > 0) {
      list.push({
        icon: "target",
        title: "Big Three",
        sub: `${bigThree} ключевых задач на день`,
        tone: "mind",
        to: "/tasks/big-three",
      });
    }

    const overdueBudget =
      finance.data?.remaining_budget_cents != null &&
      finance.data.remaining_budget_cents < 0;
    if (overdueBudget) {
      list.push({
        icon: "bolt",
        title: "Бюджет превышен",
        sub: `${formatRub(finance.data!.remaining_budget_cents!)} сверх`,
        tone: "finance",
        to: "/finance",
      });
    }

    if (list.length === 0) {
      list.push({
        icon: "sparkle",
        title: "Записать мысль",
        sub: "Голос или текст · AI разберёт",
        tone: "work",
        to: "/dump",
      });
    }

    return list;
  }, [inboxTasks.data, bigThree, finance.data]);

  const userName = user?.name ?? user?.username ?? "";
  const initials = (userName || "Я").trim().charAt(0).toUpperCase() || "Я";
  const isEmpty =
    !todayTasks.isLoading &&
    (todayTasks.data?.length ?? 0) === 0 &&
    totalToday === 0;

  return (
    <main className="home-app" aria-label={t("screens.today")}>
      <header className="home-app__head">
        <div className="home-app__avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="home-app__greet">
          <div className="home-app__greet-title">
            {userName ? `Привет, ${userName.split(" ")[0]}!` : "Привет!"}
          </div>
          <div className="home-app__greet-sub">
            {formatToday(now)} · второй мозг
          </div>
        </div>
        <Link to="/tasks" className="home-app__icon-btn" aria-label="Поиск">
          <Icon name="search" size={17} color="#20365C" />
        </Link>
        <Link
          to="/reflections"
          className="home-app__icon-btn"
          aria-label="Уведомления"
        >
          <Icon name="bell" size={17} color="#20365C" />
          {pendingTextDumps.length > 0 ? (
            <span className="home-app__icon-btn-dot" />
          ) : null}
        </Link>
      </header>

      <div className="home-app__body">
        {/* HERO: Задачи */}
        <section
          className="home-hero"
          style={{
            background: SPHERE.work.tint,
            borderColor: `${SPHERE.work.color}22`,
          }}
          onClick={() => navigate("/tasks")}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate("/tasks");
          }}
          aria-label="Открыть задачи"
        >
          <div className="home-hero__top">
            <div className="home-hero__icon">
              <Icon
                name="check"
                size={18}
                color={SPHERE.work.color}
                strokeWidth={2.2}
              />
            </div>
            <div className="home-hero__label">
              <div className="home-hero__label-title">{hero.label}</div>
              <div
                className="home-hero__label-when"
                style={{ color: SPHERE.work.color }}
              >
                {hero.when}
              </div>
            </div>
            <button
              type="button"
              className="home-hero__small-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/dump");
              }}
              aria-label="Записать"
            >
              <Icon
                name="plus"
                size={16}
                color={SPHERE.work.color}
                strokeWidth={2.4}
              />
            </button>
            <button
              type="button"
              className="home-hero__small-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/tasks/more");
              }}
              aria-label="Ещё"
            >
              <Icon name="more" size={16} color="#3E527A" />
            </button>
          </div>

          <div className="home-hero__row">
            <div>
              <div className="home-hero__big">{totalToday}</div>
              <div className="home-hero__big-sub">задач на сегодня</div>
            </div>
            <div className="home-hero__ring" aria-hidden="true">
              <svg width="60" height="60" viewBox="0 0 60 60">
                <circle
                  cx="30"
                  cy="30"
                  r="24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="6"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="24"
                  fill="none"
                  stroke={SPHERE.work.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${ringDash} ${ringTotal}`}
                  transform="rotate(-90 30 30)"
                />
              </svg>
              <div className="home-hero__ring-text">{progress}%</div>
            </div>
          </div>

          <div className="home-hero__kpis">
            {hero.kpis.map((k) => (
              <div key={k.l} className="home-hero__kpi">
                <div className="home-hero__kpi-v">{k.v}</div>
                <div className="home-hero__kpi-l">{k.l}</div>
              </div>
            ))}
          </div>

          <div className="home-hero__footer">
            <div className="home-hero__footer-l">Сегодня · открыть</div>
            <span
              className="home-hero__footer-cta"
              style={{ color: SPHERE.work.color }}
            >
              Открыть{" "}
              <Icon
                name="chevron"
                size={13}
                color={SPHERE.work.color}
                strokeWidth={2.4}
              />
            </span>
          </div>
        </section>

        {/* 2x2 GRID */}
        <div className="home-grid">
          {sections.map((s) => {
            const c = SPHERE[s.sphere].color;
            const tint = SPHERE[s.sphere].tint;
            return (
              <Link
                key={s.id}
                to={s.to}
                className="home-tile"
                style={{
                  background: tint,
                  borderColor: `${c}22`,
                }}
              >
                <div className="home-tile__top">
                  <div className="home-tile__icon">
                    <Icon name={s.icon} size={15} color={c} strokeWidth={2.2} />
                  </div>
                  <div className="home-tile__label" style={{ color: c }}>
                    {s.label}
                  </div>
                </div>

                <div className="home-tile__body">
                  <div className="home-tile__kicker">{s.kicker}</div>
                  <div className="home-tile__stat">{s.stat}</div>
                  <div className="home-tile__sub">{s.sub}</div>
                </div>

                <div
                  className="home-tile__footer"
                  style={{ borderTopColor: `${c}30` }}
                >
                  <div className="home-tile__footer-l" style={{ color: c }}>
                    Открыть
                  </div>
                  <div className="home-tile__chev">
                    <Icon
                      name="chevron"
                      size={11}
                      color={c}
                      strokeWidth={2.4}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Recommendations */}
        <div className="home-section-title">
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="sparkle" size={13} color="#2E5BFF" /> Сегодня ·
            рекомендации
          </span>
          <span className="home-section-title__count">{recs.length}</span>
        </div>

        <div className="home-recs">
          {recs.map((r, i) => {
            const c = SPHERE[r.tone].color;
            const tint = SPHERE[r.tone].tint;
            return (
              <Link key={i} to={r.to} className="home-rec">
                <div
                  className="home-rec__swatch"
                  style={{ background: tint }}
                />
                <div
                  className="home-rec__icon"
                  style={{ background: tint, color: c }}
                >
                  <Icon name={r.icon} size={14} color={c} />
                </div>
                <div className="home-rec__body">
                  <div className="home-rec__title">{r.title}</div>
                  <div className="home-rec__sub">{r.sub}</div>
                </div>
                <div className="home-rec__cta" style={{ color: c }}>
                  Открыть{" "}
                  <Icon name="chevron" size={10} color={c} strokeWidth={2.4} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Today tasks list */}
        <div className="home-section-title">
          <span>Задачи на сегодня</span>
          <span className="home-section-title__count">
            {doneToday}/{totalToday}
          </span>
        </div>

        {todayTasks.isLoading ? (
          <p className="home-empty">{t("common.loading")}</p>
        ) : null}

        {todayTasks.error ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => void todayTasks.refetch()}
          >
            {t("common.retry")}
          </button>
        ) : null}

        {isEmpty ? <p className="home-empty">{t("today.empty")}</p> : null}

        <div
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
          className="home-tasks"
        >
          {tasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "12px 14px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                boxShadow:
                  "0 1px 2px rgba(11, 31, 62, 0.04), 0 0 0 1px rgba(11, 31, 62, 0.04)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  flex: "0 0 22px",
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  border: task.is_done
                    ? "1.5px solid #2E5BFF"
                    : "1.5px solid #B0BCD2",
                  background: task.is_done ? "#2E5BFF" : "#fff",
                  marginTop: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {task.is_done ? (
                  <Icon name="check" size={12} color="#fff" strokeWidth={2.6} />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: task.is_done ? "#8395B3" : "#0B1F3E",
                    textDecoration: task.is_done ? "line-through" : "none",
                    lineHeight: 1.3,
                  }}
                >
                  {task.title}
                </div>
                {task.deadline ? (
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#5C6F92",
                      marginTop: 4,
                    }}
                  >
                    {task.deadline}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
