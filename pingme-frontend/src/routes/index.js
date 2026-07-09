import { Suspense, lazy } from "react";
import { Navigate, useRoutes, useLocation } from "react-router-dom";
import DashboardLayout from "../layouts/dashboard";
import { useAuth } from "../contexts/AuthContext";
import { DEFAULT_PATH } from "../config";
import LoadingScreen from "../components/LoadingScreen";

// Static file extensions that should never be handled by React Router
const STATIC_EXTENSIONS = /\.(xml|txt|json|ico|png|jpg|jpeg|svg|webp|woff|woff2|ttf|eot|css|js|map|pdf)$/i;

/**
 * StaticFileGuard — Prevents static files from being redirected to /login.
 * If the URL looks like a static file (e.g. /sitemap.xml), return null so
 * the browser can fetch it naturally. Otherwise redirect to /login.
 */
const StaticFileGuard = () => {
  const { pathname } = useLocation();
  if (STATIC_EXTENSIONS.test(pathname)) return null;
  return <Navigate to="/login" replace />;
};

const Loadable = (Component) => (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <Component {...props} />
  </Suspense>
);

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const GuestRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to={DEFAULT_PATH} replace />;
};

export default function Router() {
  return useRoutes([
    { path: "/login", element: <GuestRoute><LoginPage /></GuestRoute> },
    { path: "/register", element: <GuestRoute><RegisterPage /></GuestRoute> },
    // Password reset flow — accessible to unauthenticated users only
    { path: "/forgot-password", element: <GuestRoute><ForgotPasswordPage /></GuestRoute> },
    { path: "/verify-otp", element: <OTPVerificationPage /> },
    { path: "/reset-password", element: <ResetPasswordPage /> },
    {
      path: "/",
      element: <PrivateRoute><DashboardLayout /></PrivateRoute>,
      children: [
        { element: <Navigate to={DEFAULT_PATH} replace />, index: true },
        { path: "app", element: <GeneralApp /> },
        { path: "groups", element: <GroupsPage /> },
        { path: "calls", element: <CallHistoryPage /> },
        { path: "settings", element: <SettingsPage /> },
        { path: "tasks", element: <TasksPage /> },
        { path: "404", element: <Page404 /> },
        { path: "*", element: <Navigate to="/404" replace /> },
      ],
    },
    { path: "*", element: <StaticFileGuard /> },
  ]);
}

const GeneralApp = Loadable(lazy(() => import("../pages/dashboard/GeneralApp")));
const GroupsPage = Loadable(lazy(() => import("../pages/dashboard/GroupsPage")));
const CallHistoryPage = Loadable(lazy(() => import("../pages/dashboard/CallHistoryPage")));
const SettingsPage = Loadable(lazy(() => import("../pages/dashboard/SettingsPage")));
const TasksPage = Loadable(lazy(() => import("../pages/dashboard/TasksPage")));
const Page404 = Loadable(lazy(() => import("../pages/Page404")));
const LoginPage = Loadable(lazy(() => import("../pages/auth/LoginPage")));
const RegisterPage = Loadable(lazy(() => import("../pages/auth/RegisterPage")));
const ForgotPasswordPage = Loadable(lazy(() => import("../pages/auth/ForgotPasswordPage")));
const OTPVerificationPage = Loadable(lazy(() => import("../pages/auth/OTPVerificationPage")));
const ResetPasswordPage = Loadable(lazy(() => import("../pages/auth/ResetPasswordPage")));
