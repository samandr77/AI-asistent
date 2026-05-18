import type { PropsWithChildren, ReactElement } from "react";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";

import { AccountPendingDeletionScreen } from "../screens/account/AccountPendingDeletionScreen";
import { DumpScreen } from "../screens/dump/DumpScreen";
import { ResultScreen } from "../screens/dump/ResultScreen";
import { GoalDetailScreen } from "../screens/goals/GoalDetailScreen";
import { GoalsScreen } from "../screens/goals/GoalsScreen";
import { NewGoalScreen } from "../screens/goals/NewGoalScreen";
import { LaunchScreen } from "../screens/launch/LaunchScreen";
import { UnsupportedScreen } from "../screens/launch/UnsupportedScreen";
import { FirstDumpScreen } from "../screens/onboarding/FirstDumpScreen";
import { SetupScreen } from "../screens/onboarding/SetupScreen";
import { PremiumScreen } from "../screens/premium/PremiumScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { ReflectionDetailScreen } from "../screens/reflection/ReflectionDetailScreen";
import { ReflectionListScreen } from "../screens/reflection/ReflectionListScreen";
import { ReflectionSettingsScreen } from "../screens/reflection/ReflectionSettingsScreen";
import { TodayReflectionScreen } from "../screens/reflection/TodayReflectionScreen";
import { SupportScreen } from "../screens/support/SupportScreen";
import { TaskDetailScreen } from "../screens/tasks/TaskDetailScreen";
import { TasksScreen } from "../screens/tasks/TasksScreen";
import { TodayScreen } from "../screens/today/TodayScreen";
import { useSessionStore } from "../store/useSessionStore";
import { NotFoundScreen } from "./screens";

function RequireSession({ children }: PropsWithChildren) {
  const location = useLocation();
  const sessionToken = useSessionStore((state) => state.sessionToken);

  if (!sessionToken) {
    return <Navigate to="/launch" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function protectedRoute(element: ReactElement) {
  return <RequireSession>{element}</RequireSession>;
}

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/launch" replace /> },
  { path: "/launch", element: <LaunchScreen /> },
  { path: "/unsupported", element: <UnsupportedScreen /> },
  { path: "/onboarding/setup", element: protectedRoute(<SetupScreen />) },
  { path: "/onboarding/first-dump", element: protectedRoute(<FirstDumpScreen />) },
  { path: "/today", element: protectedRoute(<TodayScreen />) },
  { path: "/dump", element: protectedRoute(<DumpScreen />) },
  { path: "/dump/result", element: protectedRoute(<ResultScreen />) },
  { path: "/tasks", element: protectedRoute(<TasksScreen />) },
  { path: "/tasks/:taskId", element: protectedRoute(<TaskDetailScreen />) },
  { path: "/goals", element: protectedRoute(<GoalsScreen />) },
  { path: "/goals/new", element: protectedRoute(<NewGoalScreen />) },
  { path: "/goals/:goalId", element: protectedRoute(<GoalDetailScreen />) },
  { path: "/reflections", element: protectedRoute(<ReflectionListScreen />) },
  { path: "/reflections/today", element: protectedRoute(<TodayReflectionScreen />) },
  {
    path: "/reflections/settings",
    element: protectedRoute(<ReflectionSettingsScreen />),
  },
  { path: "/reflections/:date", element: protectedRoute(<ReflectionDetailScreen />) },
  { path: "/premium", element: protectedRoute(<PremiumScreen />) },
  { path: "/profile", element: protectedRoute(<ProfileScreen />) },
  { path: "/support", element: protectedRoute(<SupportScreen />) },
  {
    path: "/account/pending-deletion",
    element: <AccountPendingDeletionScreen />,
  },
  { path: "*", element: <NotFoundScreen /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
