import { Link } from "react-router-dom";

import { updateTask } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import { notify } from "../telegram/haptics";
import type { Task } from "../types/api";
import { SPHERE_MAP } from "../constants/spheres";

interface TaskCardProps {
  task: Task;
}

const priorityLabel: Record<Task["priority"], string> = {
  1: "P1",
  2: "P2",
  3: "P3",
};

export function TaskCard({ task }: TaskCardProps) {
  const updateTaskInStore = useAppStore((state) => state.updateTaskInStore);
  const sphere = task.sphere ? SPHERE_MAP[task.sphere] : null;

  async function markDone() {
    try {
      const updated = await updateTask(task.id, { is_done: true });
      updateTaskInStore(task.id, updated);
      notify("success");
    } catch (error) {
      notify("error");
      console.error(error);
    }
  }

  return (
    <article className="task-card">
      <div
        className="task-card__accent"
        style={{ background: sphere?.color ?? "var(--tg-hint-color)" }}
      />
      <Link
        className="task-card__body"
        to={`/tasks/${task.id}`}
        state={{ task }}
      >
        <h2>{task.title}</h2>
        <p>
          {sphere?.id ?? task.sphere} · {priorityLabel[task.priority]}
          {task.deadline
            ? ` · ${new Date(task.deadline).toLocaleDateString()}`
            : ""}
        </p>
      </Link>
      <button
        className="icon-button"
        type="button"
        onClick={() => void markDone()}
      >
        Done
      </button>
    </article>
  );
}
