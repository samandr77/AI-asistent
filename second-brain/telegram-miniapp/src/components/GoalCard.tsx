import { Link } from "react-router-dom";

import type { Goal } from "../types/api";
import { ProgressBar } from "./ProgressBar";

interface GoalCardProps {
  goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  return (
    <article className="goal-card">
      <Link to={`/goals/${goal.id}`} state={{ goal }}>
        <h2>{goal.title}</h2>
        <p>
          {goal.status}
          {goal.target_date
            ? ` · ${new Date(goal.target_date).toLocaleDateString()}`
            : ""}
        </p>
        <ProgressBar value={goal.progress_percent} />
        <span>{goal.progress_percent}%</span>
      </Link>
    </article>
  );
}
