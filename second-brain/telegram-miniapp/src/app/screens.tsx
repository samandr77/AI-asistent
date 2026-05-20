import { Link } from "react-router-dom";

interface PlaceholderScreenProps {
  title: string;
  description?: string;
}

export function PlaceholderScreen({
  title,
  description = "Экран зарезервирован в роутере Telegram Mini App.",
}: PlaceholderScreenProps) {
  return (
    <main className="screen">
      <section className="panel">
        <p className="eyebrow">Второй мозг</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        <nav className="action-row" aria-label="Основная навигация">
          <Link className="button" to="/today">
            Сегодня
          </Link>
          <Link className="button secondary" to="/dump">
            Записать мысль
          </Link>
        </nav>
      </section>
    </main>
  );
}

export function NotFoundScreen() {
  return (
    <PlaceholderScreen
      title="Экран не найден"
      description="Маршрут не зарегистрирован в Telegram Mini App."
    />
  );
}
