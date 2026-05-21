import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Icon } from "../tasks/components/Icon";
import { getGoalTree, listGoals } from "../../services/api";
import type { GoalLevel, GoalTreeNode } from "../../types/api";
import {
  GoalsBody,
  GoalsIconButton,
  GoalsScreenLayout,
  GoalsTopBar,
  levelColor,
  levelLabel,
} from "./components/shell";

const LEVEL_TABS: { id: "all" | GoalLevel; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "life", label: "Жизнь" },
  { id: "year", label: "Год" },
  { id: "quarter", label: "Квартал" },
  { id: "week", label: "Неделя" },
];

function GoalNode({ node, depth }: { node: GoalTreeNode; depth: number }) {
  const { color, tint } = levelColor(node.goal.level ?? "year");
  const progress =
    node.goal.computed_progress ?? node.goal.progress_percent ?? 0;
  const krCount = node.goal.key_results_count ?? 0;
  const krDone = node.goal.key_results_done_count ?? 0;
  const tasks = node.goal.linked_tasks_count ?? 0;
  const tasksDone = node.goal.completed_tasks_count ?? 0;

  return (
    <>
      <Link to={`/goals/${node.goal.id}`} className="g-goal-card">
        <div className="g-goal-card__top">
          <span
            className="g-goal-card__chip"
            style={{ background: tint, color }}
          >
            {levelLabel(node.goal.level ?? "year")}
          </span>
          <span className="g-goal-card__title">{node.goal.title}</span>
        </div>
        <div className="g-goal-card__bar">
          <i
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: color,
            }}
          />
        </div>
        <div className="g-goal-card__meta">
          <div className="g-goal-card__meta-l">
            {krCount > 0 ? (
              <span>
                KR{" "}
                <b>
                  {krDone}/{krCount}
                </b>
              </span>
            ) : null}
            {tasks > 0 ? (
              <span>
                задачи{" "}
                <b>
                  {tasksDone}/{tasks}
                </b>
              </span>
            ) : null}
            {node.goal.target_date ? (
              <span>до {node.goal.target_date}</span>
            ) : null}
          </div>
          <span className="g-goal-card__meta-pct">{progress}%</span>
        </div>
      </Link>
      {node.children.length > 0 ? (
        <div className="g-tree__children" data-depth={depth + 1}>
          {node.children.map((child) => (
            <GoalNode key={child.goal.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function GoalsScreen() {
  const { t } = useTranslation();
  const [levelTab, setLevelTab] = useState<"all" | GoalLevel>("all");

  const tree = useQuery({
    queryKey: ["goals", "tree"],
    queryFn: getGoalTree,
  });

  const flat = useQuery({
    queryKey: ["goals", "list", "active"],
    queryFn: () => listGoals({ status: "active" }),
  });

  const totals = useMemo(() => {
    const goals = flat.data ?? [];
    const active = goals.length;
    const avg =
      active > 0
        ? Math.round(
            goals.reduce((sum, g) => sum + (g.progress_percent ?? 0), 0) /
              active,
          )
        : 0;
    const lifeCount = goals.filter((g) => g.level === "life").length;
    const quarterCount = goals.filter((g) => g.level === "quarter").length;
    return { active, avg, lifeCount, quarterCount };
  }, [flat.data]);

  const ringTotal = 2 * Math.PI * 24;
  const ringDash = (ringTotal * totals.avg) / 100;

  const fallbackTree = useMemo<GoalTreeNode[]>(() => {
    const list = flat.data ?? [];
    if (list.length === 0) return [];
    const nodes: Record<string, GoalTreeNode> = {};
    for (const g of list) {
      nodes[g.id] = {
        goal: {
          ...g,
          computed_progress: g.progress_percent,
          linked_tasks_count: 0,
          completed_tasks_count: 0,
          key_results_count: 0,
          key_results_done_count: 0,
          children_count: 0,
        },
        children: [],
      };
    }
    const roots: GoalTreeNode[] = [];
    for (const g of list) {
      const node = nodes[g.id];
      if (g.parent_goal_id && nodes[g.parent_goal_id]) {
        nodes[g.parent_goal_id].children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }, [flat.data]);

  const effectiveTree =
    (tree.data?.length ?? 0) > 0 ? (tree.data ?? []) : fallbackTree;

  const filtered = useMemo<GoalTreeNode[]>(() => {
    const all = effectiveTree;
    if (levelTab === "all") return all;
    const flatten = (nodes: GoalTreeNode[]): GoalTreeNode[] =>
      nodes.flatMap((n) => [n, ...flatten(n.children)]);
    return flatten(all).filter((n) => (n.goal.level ?? "year") === levelTab);
  }, [effectiveTree, levelTab]);

  return (
    <GoalsScreenLayout>
      <GoalsTopBar
        title="Цели"
        eyebrow={t("app.name")}
        right={
          <>
            <GoalsIconButton
              to="/goals/strategy"
              ariaLabel="Стратегия"
              icon="sparkle"
            />
            <GoalsIconButton
              to="/goals/new"
              ariaLabel="Новая цель"
              icon="plus"
            />
          </>
        }
      />

      <GoalsBody>
        <section className="g-hero">
          <div className="g-hero__row">
            <div className="g-hero__icon">
              <Icon name="target" size={18} color="#6E5BF6" strokeWidth={2.2} />
            </div>
            <div className="g-hero__title">
              <strong>OKR · Цели</strong>
              <span>Жизнь → Год → Квартал → Неделя</span>
            </div>
          </div>
          <div className="g-hero__big">
            <div>
              <div className="g-hero__big-num">{totals.active}</div>
              <div className="g-hero__big-sub">активных целей</div>
            </div>
            <div className="g-hero__ring" aria-hidden="true">
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
                  stroke="#6E5BF6"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${ringDash} ${ringTotal}`}
                  transform="rotate(-90 30 30)"
                />
              </svg>
              <div className="g-hero__ring-text">{totals.avg}%</div>
            </div>
          </div>
          <div className="g-hero__kpis">
            <div className="g-hero__kpi">
              <div className="g-hero__kpi-v">{totals.lifeCount}</div>
              <div className="g-hero__kpi-l">Жизнь</div>
            </div>
            <div className="g-hero__kpi">
              <div className="g-hero__kpi-v">{totals.quarterCount}</div>
              <div className="g-hero__kpi-l">Квартал</div>
            </div>
            <div className="g-hero__kpi">
              <div className="g-hero__kpi-v">{totals.avg}%</div>
              <div className="g-hero__kpi-l">Прогресс</div>
            </div>
            <div className="g-hero__kpi">
              <div className="g-hero__kpi-v">{totals.active}</div>
              <div className="g-hero__kpi-l">Активны</div>
            </div>
          </div>
        </section>

        <div className="g-segmented" role="tablist" aria-label="OKR-уровень">
          {LEVEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`g-segmented__btn ${levelTab === tab.id ? "active" : ""}`}
              onClick={() => setLevelTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="g-section-title">
          <span>OKR-дерево</span>
          <span className="g-section-title__count">{filtered.length}</span>
        </div>

        {tree.isLoading ? (
          <p className="g-empty">{t("common.loading")}</p>
        ) : null}

        {tree.error ? (
          <button
            type="button"
            className="g-btn ghost"
            onClick={() => void tree.refetch()}
          >
            {t("common.retry")}
          </button>
        ) : null}

        {!tree.isLoading && filtered.length === 0 ? (
          <div className="g-empty">
            Пока нет целей. Создай первую через «+» — это первый шаг к фокусу.
          </div>
        ) : null}

        <div className="g-tree">
          {filtered.map((node) => (
            <GoalNode key={node.goal.id} node={node} depth={0} />
          ))}
        </div>

        <Link to="/goals/new" className="g-btn primary lg g-btn--full">
          <Icon name="plus" size={16} color="#fff" strokeWidth={2.4} /> Новая
          цель
        </Link>
      </GoalsBody>
    </GoalsScreenLayout>
  );
}
