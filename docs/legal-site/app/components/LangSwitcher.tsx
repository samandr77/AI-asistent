import Link from "next/link";
import type { Lang } from "../../lib/markdown";

export default function LangSwitcher({
  path,
  current,
}: {
  path: string;
  current: Lang;
}) {
  const linkStyle = (isActive: boolean) => ({
    padding: "6px 12px",
    borderRadius: 6,
    background: isActive ? "#4F8EF7" : "transparent",
    color: isActive ? "white" : "#888",
    textDecoration: "none",
    fontSize: 14,
  });

  return (
    <nav style={{ display: "flex", gap: 8, marginBottom: 32 }}>
      <Link href={`${path}?lang=ru`} style={linkStyle(current === "ru")}>
        RU
      </Link>
      <Link href={`${path}?lang=en`} style={linkStyle(current === "en")}>
        EN
      </Link>
    </nav>
  );
}
