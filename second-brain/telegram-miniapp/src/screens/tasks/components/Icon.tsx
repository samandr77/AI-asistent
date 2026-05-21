import type { CSSProperties, ReactElement } from "react";

export type TaskIconName =
  | "plus"
  | "check"
  | "search"
  | "filter"
  | "calendar"
  | "clock"
  | "flag"
  | "mic"
  | "send"
  | "sparkle"
  | "inbox"
  | "fire"
  | "trend"
  | "bell"
  | "more"
  | "chevron"
  | "chevron-down"
  | "chevron-left"
  | "play"
  | "pause"
  | "folder"
  | "tag"
  | "settings"
  | "handle"
  | "info"
  | "bolt"
  | "home"
  | "chart"
  | "grid"
  | "target"
  | "repeat"
  | "user"
  | "location"
  | "link"
  | "paperclip"
  | "moon"
  | "coffee";

const PATHS: Record<TaskIconName, ReactElement> = {
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" />
    </>
  ),
  send: <path d="M5 12l16-7-7 16-2-7-7-2z" />,
  sparkle: (
    <>
      <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
      <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7L19 16z" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 12l3-7h12l3 7v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z" />
      <path d="M3 12h5l1.5 2.5h5L16 12h5" />
    </>
  ),
  fire: <path d="M12 3s4 4 4 8a4 4 0 11-8 0c0-1.5.5-3 1.5-4-1 3 2 3 2.5-4z" />,
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-9" />
      <path d="M14 6h7v7" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1112 0v5l2 2H4l2-2z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
  "chevron-down": <path d="M5 9l7 7 7-7" />,
  "chevron-left": <path d="M15 5l-7 7 7 7" />,
  play: <path d="M7 5l12 7-12 7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  folder: (
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  ),
  tag: (
    <>
      <path d="M3 11V5a2 2 0 012-2h6l9 9a2 2 0 010 2.8l-6.2 6.2a2 2 0 01-2.8 0L3 11z" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12c0-.7-.1-1.4-.3-2l2-1.2-2-3.5-2.3.8a7 7 0 00-3.4-2L12.5 2h-1l-.5 2.1a7 7 0 00-3.4 2l-2.3-.8-2 3.5L5.3 10c-.2.6-.3 1.3-.3 2s.1 1.4.3 2l-2 1.2 2 3.5 2.3-.8a7 7 0 003.4 2l.5 2.1h1l.5-2.1a7 7 0 003.4-2l2.3.8 2-3.5-2-1.2c.2-.6.3-1.3.3-2z" />
    </>
  ),
  handle: (
    <>
      <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  home: <path d="M4 11l8-7 8 7v8a2 2 0 01-2 2h-3v-6h-6v6H6a2 2 0 01-2-2v-8z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 9V7a2 2 0 012-2h11l-2-2m2 2l-2 2" />
      <path d="M20 15v2a2 2 0 01-2 2H7l2 2m-2-2l2-2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  location: (
    <>
      <path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  paperclip: (
    <path d="M21 11l-8.5 8.5a5 5 0 01-7-7l9-9a3 3 0 014 4l-8.5 8.5a1.5 1.5 0 11-2-2l7-7" />
  ),
  moon: <path d="M20 14A8 8 0 1110 4a7 7 0 0010 10z" />,
  coffee: (
    <>
      <path d="M4 8h12v6a4 4 0 01-4 4H8a4 4 0 01-4-4V8z" />
      <path d="M16 10h2a2 2 0 012 2 2 2 0 01-2 2h-2M7 4v2M11 4v2" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.7,
  style,
}: {
  name: TaskIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
