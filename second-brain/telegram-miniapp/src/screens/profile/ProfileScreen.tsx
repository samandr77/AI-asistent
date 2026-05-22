import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import {
  deleteAccount,
  getMe,
  getMemoryProfile,
  getPremiumStatus,
} from "../../services/api";
import { useAppStore } from "../../store/useAppStore";
import { useSessionStore } from "../../store/useSessionStore";

import "./profile.css";

/* ─── Icons (small inline SVGs) ─── */

type IconName =
  | "brain"
  | "doc"
  | "chev"
  | "shield"
  | "lock"
  | "trash"
  | "spark"
  | "user"
  | "pencil";

function Ic({ name, size = 22 }: { name: IconName; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "brain":
      return (
        <svg {...props}>
          <path d="M9.5 3.5a3 3 0 0 0-3 3v.4a2.8 2.8 0 0 0-2 4.4 2.8 2.8 0 0 0 2 4.4v.3a3 3 0 0 0 3 3M14.5 3.5a3 3 0 0 1 3 3v.4a2.8 2.8 0 0 1 2 4.4 2.8 2.8 0 0 1-2 4.4v.3a3 3 0 0 1-3 3" />
          <path d="M9.5 8h-2M9.5 12h-2M9.5 16h-2M14.5 8h2M14.5 12h2M14.5 16h2" />
        </svg>
      );
    case "doc":
      return (
        <svg {...props}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
      );
    case "chev":
      return (
        <svg {...props} width={size} height={size}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "trash":
      return (
        <svg {...props}>
          <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
        </svg>
      );
    case "spark":
      return (
        <svg {...props}>
          <path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...props}>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
  }
}

/* ─── Helpers ─── */

function profileCompletion(
  profile:
    | {
        name?: string | null;
        email?: string | null;
        language?: string | null;
        role?: string | null;
        living_with?: string | null;
        peak_hours?: string | null;
      }
    | null
    | undefined,
): number {
  if (!profile) return 0;
  const fields: Array<unknown> = [
    profile.name,
    profile.email,
    profile.language,
    profile.role,
    profile.living_with,
    profile.peak_hours,
  ];
  const filled = fields.filter((v) => v && String(v).trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

function fmtTime(): string {
  return new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Avatar with progress ring ─── */

function AvatarWithRing({
  initial,
  percent,
  photoUrl,
}: {
  initial: string;
  percent: number;
  photoUrl?: string | null;
}) {
  const size = 88;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div className="profile-avatar">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="profile-avatar__ring"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#D4E6DA"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1F5240"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(c * percent) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {photoUrl ? (
        <img className="profile-avatar__img" src={photoUrl} alt="" />
      ) : (
        <div className="profile-avatar__initial">{initial}</div>
      )}
      <div className="profile-avatar__badge" aria-hidden="true">
        <Ic name="pencil" size={14} />
      </div>
    </div>
  );
}

/* ─── Toggle switch ─── */

function Toggle({
  on,
  onClick,
  ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className={`profile-toggle${on ? " on" : ""}`}
      onClick={onClick}
      aria-pressed={on}
      aria-label={ariaLabel}
    >
      <span className="profile-toggle__knob" />
    </button>
  );
}

/* ─── Section block ─── */

function SectionHead({
  icon,
  title,
  hint,
  action,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="profile-section__head">
      <div className="profile-section__head-left">
        {icon ? (
          <div className="profile-section__icon">
            <Ic name={icon} size={18} />
          </div>
        ) : null}
        <div>
          <h2>{title}</h2>
          {hint ? <p>{hint}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ─── ProfileScreen ─── */

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const allTasks = useAppStore((state) => state.allTasks);

  const meQuery = useQuery({ queryKey: ["auth-me"], queryFn: getMe });
  const memoryQuery = useQuery({
    queryKey: ["memory-profile"],
    queryFn: getMemoryProfile,
  });
  const premiumQuery = useQuery({
    queryKey: ["premium-status"],
    queryFn: getPremiumStatus,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: (response) => {
      clearSession();
      navigate("/account/pending-deletion", {
        replace: true,
        state: { scheduled_for: response.scheduled_for },
      });
    },
  });

  const profile = meQuery.data?.profile;
  const displayName = profile?.name ?? user?.name ?? "Telegram";
  const initial = (displayName.trim().charAt(0) || "А").toUpperCase();
  const username = user?.username ? `@${user.username}` : null;
  const completion = profileCompletion(profile);

  const memoryCount = memoryQuery.data?.length ?? 0;
  const memoryPreview = memoryQuery.data?.[0]?.content ?? null;

  const activeGoalsHint = useMemo(() => {
    const withGoal = allTasks.filter((task) => task.goal_id).length;
    return withGoal;
  }, [allTasks]);

  const isPremium = premiumQuery.data?.is_premium ?? false;

  /* AI behavior — local UI state (no backend persistence yet) */
  const [aiStyle, setAiStyle] = useState("Дружеский");
  const [aiFreq, setAiFreq] = useState<"Минимально" | "Нормально" | "Активно">(
    "Нормально",
  );
  const [aiDepth, setAiDepth] = useState<
    "Простые советы" | "Подробный анализ" | "Анализ с источниками"
  >("Подробный анализ");

  /* Privacy permissions — local state */
  const [perms, setPerms] = useState({
    health: true,
    fin: true,
    tasks: true,
    cal: false,
    docs: false,
  });
  function togglePerm(key: keyof typeof perms) {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function signOut() {
    clearSession();
    navigate("/launch", { replace: true });
  }

  function requestDeletion() {
    const message = isPremium
      ? t("profile.deletePremiumConfirm")
      : t("profile.deleteConfirm");
    if (window.confirm(message)) {
      deleteMutation.mutate();
    }
  }

  return (
    <main className="profile-app" aria-label={t("screens.profile")}>
      <header className="profile-header">
        <div className="profile-header__kicker">ВТОРОЙ МОЗГ</div>
        <h1>{t("screens.profile")}</h1>
      </header>

      {/* Hero card */}
      <section className="profile-card profile-hero">
        <div className="profile-hero__top">
          <AvatarWithRing
            initial={initial}
            percent={completion}
            photoUrl={user?.photo_url}
          />
          <div className="profile-hero__main">
            <h2>{displayName}</h2>
            {username ? (
              <div className="profile-hero__sub">{username}</div>
            ) : null}
            <div className="profile-hero__hint">
              AI помогает управлять твоей жизнью
            </div>
          </div>
        </div>

        <div className="profile-hero__progress">
          <div className="profile-hero__progress-head">
            <span>Профиль заполнен</span>
            <span className="profile-hero__progress-value">{completion}%</span>
          </div>
          <div className="profile-hero__progress-bar">
            <div style={{ width: `${completion}%` }} />
          </div>
          <div className="profile-hero__progress-hint">
            Чем больше данных — тем точнее рекомендации.
          </div>
        </div>
      </section>

      {/* AI memory */}
      <section className="profile-card profile-memory">
        <div className="profile-memory__glow profile-memory__glow--a" />
        <div className="profile-memory__glow profile-memory__glow--b" />

        <div className="profile-memory__head">
          <div className="profile-memory__head-left">
            <div className="profile-memory__icon">
              <Ic name="brain" size={22} />
            </div>
            <div>
              <div className="profile-memory__title">AI-память</div>
              <div className="profile-memory__sub">
                учится месяцами и годами
              </div>
            </div>
          </div>
          <div className="profile-memory__live">
            <span />
            LIVE
          </div>
        </div>

        <div className="profile-memory__lead">
          Помнит твои цели, привычки и правила.{" "}
          {memoryPreview
            ? `Последнее: «${memoryPreview.slice(0, 80)}${
                memoryPreview.length > 80 ? "…" : ""
              }»`
            : t("profile.memoryEmpty")}
        </div>

        <div className="profile-memory__stats">
          <div>
            <div className="profile-memory__stat-value">{memoryCount}</div>
            <div className="profile-memory__stat-label">записей памяти</div>
          </div>
          <div>
            <div className="profile-memory__stat-value">{activeGoalsHint}</div>
            <div className="profile-memory__stat-label">задач с целью</div>
          </div>
          <div>
            <div className="profile-memory__stat-value">{allTasks.length}</div>
            <div className="profile-memory__stat-label">задач всего</div>
          </div>
        </div>

        <div className="profile-memory__meta">
          <span>Последнее обновление</span>
          <span className="profile-memory__meta-value">
            сегодня, {fmtTime()}
          </span>
        </div>
      </section>

      {/* AI behavior */}
      <section className="profile-card profile-ai">
        <SectionHead
          icon="spark"
          title="Поведение ассистента"
          hint="как AI обращается с тобой"
        />

        <div className="profile-ai__group">
          <div className="profile-ai__label">
            Стиль общения
            <span>{aiStyle}</span>
          </div>
          <div className="profile-ai__chips">
            {[
              "Спокойный",
              "Мотивирующий",
              "Краткий",
              "Подробный",
              "Дружеский",
            ].map((s) => (
              <button
                key={s}
                type="button"
                className={aiStyle === s ? "active" : ""}
                onClick={() => setAiStyle(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-ai__group">
          <div className="profile-ai__label">Частота напоминаний</div>
          <div className="profile-ai__segmented">
            {(["Минимально", "Нормально", "Активно"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={aiFreq === f ? "active" : ""}
                onClick={() => setAiFreq(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-ai__group">
          <div className="profile-ai__label">Глубина рекомендаций</div>
          <div className="profile-ai__radios">
            {(
              [
                { v: "Простые советы", sub: "короткие подсказки" },
                { v: "Подробный анализ", sub: "разбор контекста и факторов" },
                { v: "Анализ с источниками", sub: "+ научные ссылки" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                className={`profile-radio${aiDepth === opt.v ? " active" : ""}`}
                onClick={() => setAiDepth(opt.v)}
              >
                <span className="profile-radio__dot" />
                <span>
                  <strong>{opt.v}</strong>
                  <small>{opt.sub}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="profile-card profile-privacy">
        <SectionHead
          icon="shield"
          title="Безопасность и данные"
          hint="ты контролируешь, что видит AI"
        />

        <div className="profile-privacy__badges">
          <div className="profile-privacy__badge">
            <Ic name="lock" size={18} />
            <div>
              <small>ХРАНЕНИЕ</small>
              <strong>Локально</strong>
            </div>
          </div>
          <div className="profile-privacy__badge">
            <Ic name="shield" size={18} />
            <div>
              <small>ШИФРОВАНИЕ</small>
              <strong className="mono">AES-256</strong>
            </div>
          </div>
        </div>

        <div className="profile-privacy__group-label">Доступы AI</div>
        <div className="profile-privacy__rows">
          {(
            [
              {
                key: "health",
                label: "Здоровье",
                sub: "sleep, HRV, активность",
              },
              { key: "fin", label: "Финансы", sub: "расходы, счета, подписки" },
              { key: "tasks", label: "Задачи", sub: "OKR, проекты, дедлайны" },
              { key: "cal", label: "Календарь", sub: "встречи и события" },
              { key: "docs", label: "Документы", sub: "PDF, договоры, чеки" },
            ] as const
          ).map((row) => (
            <div key={row.key} className="profile-privacy__row">
              <div>
                <div className="profile-privacy__row-label">{row.label}</div>
                <div className="profile-privacy__row-sub">{row.sub}</div>
              </div>
              <Toggle
                on={perms[row.key]}
                onClick={() => togglePerm(row.key)}
                ariaLabel={`Доступ AI: ${row.label}`}
              />
            </div>
          ))}
        </div>

        <a
          className="profile-privacy__link"
          href="https://second-brain.app/privacy"
          target="_blank"
          rel="noreferrer"
        >
          {t("profile.privacy")}
        </a>
      </section>

      {/* Account rows */}
      <section className="profile-card profile-account">
        <Link to="/reflections/settings" className="profile-account__row">
          <div className="profile-account__icon">
            <Ic name="user" size={18} />
          </div>
          <div>
            <strong>Личные данные</strong>
            <small>{t("profile.remindersHint")}</small>
          </div>
          <Ic name="chev" size={16} />
        </Link>

        <div className="profile-account__row">
          <div className="profile-account__icon">
            <Ic name="spark" size={18} />
          </div>
          <div>
            <strong>Подписка</strong>
            <small>
              {isPremium
                ? `${t("profile.premiumActive")}${
                    premiumQuery.data?.expires_at
                      ? ` · до ${new Date(premiumQuery.data.expires_at).toLocaleDateString("ru-RU")}`
                      : ""
                  }`
                : t("profile.freePlan")}
            </small>
          </div>
          {isPremium ? (
            <span className="profile-account__badge">PLUS</span>
          ) : null}
        </div>

        <Link to="/support" className="profile-account__row">
          <div className="profile-account__icon">
            <Ic name="doc" size={18} />
          </div>
          <div>
            <strong>{t("screens.support")}</strong>
            <small>{t("profile.supportHint")}</small>
          </div>
          <Ic name="chev" size={16} />
        </Link>

        <a
          className="profile-account__row"
          href="https://second-brain.app/terms"
          target="_blank"
          rel="noreferrer"
        >
          <div className="profile-account__icon">
            <Ic name="doc" size={18} />
          </div>
          <div>
            <strong>{t("profile.terms")}</strong>
            <small>second-brain.app/terms</small>
          </div>
          <Ic name="chev" size={16} />
        </a>
      </section>

      {/* Sign out + delete */}
      <section className="profile-footer">
        {deleteMutation.error ? (
          <p className="profile-footer__error">{t("profile.deleteError")}</p>
        ) : null}
        <div className="profile-footer__actions">
          <button
            type="button"
            className="profile-footer__signout"
            onClick={signOut}
          >
            {t("profile.signOut")}
          </button>
          <button
            type="button"
            className="profile-footer__delete"
            onClick={requestDeletion}
            disabled={deleteMutation.isPending}
          >
            <Ic name="trash" size={16} />
            {deleteMutation.isPending
              ? t("common.loading")
              : t("profile.deleteAccount")}
          </button>
        </div>
      </section>
    </main>
  );
}
