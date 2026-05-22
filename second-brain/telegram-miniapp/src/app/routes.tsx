import type { PropsWithChildren, ReactElement } from "react";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { AccountPendingDeletionScreen } from "../screens/account/AccountPendingDeletionScreen";
import { DumpScreen } from "../screens/dump/DumpScreen";
import { ResultScreen } from "../screens/dump/ResultScreen";
import { AiAssistantScreen as FinanceAiAssistantScreen } from "../screens/finance/AiAssistantScreen";
import { AnalyticsScreen as FinanceAnalyticsScreen } from "../screens/finance/AnalyticsScreen";
import { AssetsScreen as FinanceAssetsScreen } from "../screens/finance/AssetsScreen";
import { BudgetsScreen as FinanceBudgetsScreen } from "../screens/finance/BudgetsScreen";
import { CategoriesScreen as FinanceCategoriesScreen } from "../screens/finance/CategoriesScreen";
import { DebtsScreen as FinanceDebtsScreen } from "../screens/finance/DebtsScreen";
import { FinanceScreen } from "../screens/finance/FinanceScreen";
import { GoalsScreen as FinanceGoalsScreen } from "../screens/finance/GoalsScreen";
import { IncomeScreen as FinanceIncomeScreen } from "../screens/finance/IncomeScreen";
import { MoreScreen as FinanceMoreScreen } from "../screens/finance/MoreScreen";
import { NetWorthScreen as FinanceNetWorthScreen } from "../screens/finance/NetWorthScreen";
import { SubscriptionsScreen as FinanceSubscriptionsScreen } from "../screens/finance/SubscriptionsScreen";
import { TaxesScreen as FinanceTaxesScreen } from "../screens/finance/TaxesScreen";
import { TransactionsScreen as FinanceTransactionsScreen } from "../screens/finance/TransactionsScreen";
import { GoalDetailScreen } from "../screens/goals/GoalDetailScreen";
import { GoalsScreen } from "../screens/goals/GoalsScreen";
import { KpiScreen } from "../screens/goals/KpiScreen";
import { GoalsMoreScreen } from "../screens/goals/MoreScreen";
import { NewGoalScreen } from "../screens/goals/NewGoalScreen";
import { ReviewScreen } from "../screens/goals/ReviewScreen";
import { StrategyScreen } from "../screens/goals/StrategyScreen";
import { HealthScreen } from "../screens/health/HealthScreen";
import { WorkoutsScreen } from "../screens/health/WorkoutsScreen";
import { NewWorkoutScreen } from "../screens/health/NewWorkoutScreen";
import { WorkoutDetailScreen } from "../screens/health/WorkoutDetailScreen";
import { LiveSessionScreen } from "../screens/health/LiveSessionScreen";
import { ExerciseLibraryScreen } from "../screens/health/ExerciseLibraryScreen";
import { ExerciseDetailScreen } from "../screens/health/ExerciseDetailScreen";
import { AIChatScreen as TasksAIChatScreen } from "../screens/tasks/AIChatScreen";
import { AnalyticsScreen as TasksAnalyticsScreen } from "../screens/tasks/AnalyticsScreen";
import { BigThreeScreen } from "../screens/tasks/BigThreeScreen";
import { ContextsScreen } from "../screens/tasks/ContextsScreen";
import { HabitsScreen } from "../screens/tasks/HabitsScreen";
import { InboxScreen } from "../screens/tasks/InboxScreen";
import { MatrixScreen } from "../screens/tasks/MatrixScreen";
import { TasksMoreScreen } from "../screens/tasks/MoreScreen";
import { PomodoroScreen } from "../screens/tasks/PomodoroScreen";
import { ProjectsScreen as TasksProjectsScreen } from "../screens/tasks/ProjectsScreen";
import { TimeBlockScreen } from "../screens/tasks/TimeBlockScreen";
import { LaunchScreen } from "../screens/launch/LaunchScreen";
import { UnsupportedScreen } from "../screens/launch/UnsupportedScreen";
import { FirstDumpScreen } from "../screens/onboarding/FirstDumpScreen";
import { SetupScreen } from "../screens/onboarding/SetupScreen";
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
    return (
      <Navigate to="/launch" replace state={{ from: location.pathname }} />
    );
  }

  return children;
}

function protectedRoute(element: ReactElement) {
  return (
    <RequireSession>
      <AppShell>{element}</AppShell>
    </RequireSession>
  );
}

function protectedRouteNoTabBar(element: ReactElement) {
  return (
    <RequireSession>
      <AppShell hideTabBar>{element}</AppShell>
    </RequireSession>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/launch" replace /> },
  { path: "/launch", element: <LaunchScreen /> },
  { path: "/unsupported", element: <UnsupportedScreen /> },
  {
    path: "/onboarding/setup",
    element: protectedRouteNoTabBar(<SetupScreen />),
  },
  {
    path: "/onboarding/first-dump",
    element: protectedRouteNoTabBar(<FirstDumpScreen />),
  },
  { path: "/today", element: protectedRoute(<TodayScreen />) },
  { path: "/dump", element: protectedRoute(<DumpScreen />) },
  { path: "/dump/result", element: protectedRoute(<ResultScreen />) },
  { path: "/tasks", element: protectedRoute(<TasksScreen />) },
  { path: "/tasks/inbox", element: protectedRoute(<InboxScreen />) },
  { path: "/tasks/more", element: protectedRoute(<TasksMoreScreen />) },
  { path: "/tasks/ai", element: protectedRoute(<TasksAIChatScreen />) },
  { path: "/tasks/matrix", element: protectedRoute(<MatrixScreen />) },
  { path: "/tasks/big-three", element: protectedRoute(<BigThreeScreen />) },
  { path: "/tasks/timeblock", element: protectedRoute(<TimeBlockScreen />) },
  { path: "/tasks/focus", element: protectedRoute(<PomodoroScreen />) },
  { path: "/tasks/projects", element: protectedRoute(<TasksProjectsScreen />) },
  { path: "/tasks/habits", element: protectedRoute(<HabitsScreen />) },
  { path: "/tasks/contexts", element: protectedRoute(<ContextsScreen />) },
  {
    path: "/tasks/analytics",
    element: protectedRoute(<TasksAnalyticsScreen />),
  },
  { path: "/finance", element: protectedRoute(<FinanceScreen />) },
  { path: "/health", element: protectedRoute(<HealthScreen />) },
  { path: "/health/workouts", element: protectedRoute(<WorkoutsScreen />) },
  {
    path: "/health/workouts/new",
    element: protectedRoute(<NewWorkoutScreen />),
  },
  {
    path: "/health/workouts/:workoutId",
    element: protectedRoute(<WorkoutDetailScreen />),
  },
  {
    path: "/health/workouts/:workoutId/log",
    element: protectedRouteNoTabBar(<LiveSessionScreen />),
  },
  {
    path: "/health/exercises",
    element: protectedRoute(<ExerciseLibraryScreen />),
  },
  {
    path: "/health/exercises/:slug",
    element: protectedRoute(<ExerciseDetailScreen />),
  },
  {
    path: "/finance/transactions",
    element: protectedRoute(<FinanceTransactionsScreen />),
  },
  {
    path: "/finance/budgets",
    element: protectedRoute(<FinanceBudgetsScreen />),
  },
  {
    path: "/finance/categories",
    element: protectedRoute(<FinanceCategoriesScreen />),
  },
  {
    path: "/finance/ai",
    element: protectedRoute(<FinanceAiAssistantScreen />),
  },
  { path: "/finance/more", element: protectedRoute(<FinanceMoreScreen />) },
  { path: "/finance/goals", element: protectedRoute(<FinanceGoalsScreen />) },
  {
    path: "/finance/net-worth",
    element: protectedRoute(<FinanceNetWorthScreen />),
  },
  { path: "/finance/assets", element: protectedRoute(<FinanceAssetsScreen />) },
  { path: "/finance/income", element: protectedRoute(<FinanceIncomeScreen />) },
  {
    path: "/finance/subscriptions",
    element: protectedRoute(<FinanceSubscriptionsScreen />),
  },
  { path: "/finance/debts", element: protectedRoute(<FinanceDebtsScreen />) },
  { path: "/finance/taxes", element: protectedRoute(<FinanceTaxesScreen />) },
  {
    path: "/finance/analytics",
    element: protectedRoute(<FinanceAnalyticsScreen />),
  },
  { path: "/tasks/:taskId", element: protectedRoute(<TaskDetailScreen />) },
  { path: "/goals", element: protectedRoute(<GoalsScreen />) },
  { path: "/goals/new", element: protectedRoute(<NewGoalScreen />) },
  { path: "/goals/strategy", element: protectedRoute(<StrategyScreen />) },
  { path: "/goals/kpi", element: protectedRoute(<KpiScreen />) },
  { path: "/goals/review", element: protectedRoute(<ReviewScreen />) },
  { path: "/goals/more", element: protectedRoute(<GoalsMoreScreen />) },
  { path: "/goals/:goalId", element: protectedRoute(<GoalDetailScreen />) },
  { path: "/reflections", element: protectedRoute(<ReflectionListScreen />) },
  {
    path: "/reflections/today",
    element: protectedRoute(<TodayReflectionScreen />),
  },
  {
    path: "/reflections/settings",
    element: protectedRoute(<ReflectionSettingsScreen />),
  },
  {
    path: "/reflections/:date",
    element: protectedRoute(<ReflectionDetailScreen />),
  },
  {
    path: "/premium",
    element: protectedRoute(<Navigate to="/today" replace />),
  },
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
