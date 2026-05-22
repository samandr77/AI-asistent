import type { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";

import { Icon } from "../screens/tasks/components/Icon";
import { AppTabBar } from "./AppTabBar";

type Props = PropsWithChildren<{
  hideTabBar?: boolean;
}>;

export function AppShell({ children, hideTabBar }: Props) {
  if (hideTabBar) {
    return <div className="app-shell-plain">{children}</div>;
  }

  return (
    <div className="app-shell-with-tabbar">
      <ProfileButton />
      {children}
      <AppTabBar />
    </div>
  );
}

function ProfileButton() {
  const location = useLocation();
  if (
    location.pathname === "/profile" ||
    location.pathname.startsWith("/profile/")
  ) {
    return null;
  }
  return (
    <Link to="/profile" className="app-profile-btn" aria-label="Профиль">
      <Icon name="user" size={18} color="#0B1F3E" strokeWidth={2.2} />
    </Link>
  );
}
