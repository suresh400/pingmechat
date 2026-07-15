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
  return <Navigate to="/" replace />;
};

const Loadable = (Component) => (props) => (
  <Suspense fallback={<LoadingScreen />}>
    <Component {...props} />
  </Suspense>
);

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" replace />;
};

const GuestRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to={DEFAULT_PATH} replace />;
};

export default function Router() {
  return useRoutes([
    // ── Public landing page ──
    { path: "/", element: <LandingPage /> },

    // ── Auth pages (redirect to dashboard if already logged in) ──
    { path: "/login", element: <Navigate to="/" state={{ authMode: "login" }} replace /> },
    { path: "/register", element: <Navigate to="/" replace /> },
    { path: "/forgot-password", element: <Navigate to="/" replace /> },
    { path: "/verify-otp", element: <Navigate to="/" replace /> },
    { path: "/reset-password", element: <Navigate to="/" replace /> },

    // ── Protected dashboard (using a pathless layout route to keep /app, /groups, etc. flat) ──
    {
      element: <PrivateRoute><DashboardLayout /></PrivateRoute>,
      children: [
        { path: "/app", element: <GeneralApp /> },
        { path: "/groups", element: <GroupsPage /> },
        { path: "/calls", element: <CallHistoryPage /> },
        { path: "/tasks", element: <TasksPage /> },
        { path: "/settings", element: <SettingsPage /> },
      ],
    },
    { path: "/admin", element: <AdminDashboard /> },
    
    // ── 404 Pages ──
    { path: "/404", element: <Page404 /> },
    { path: "*", element: <StaticFileGuard /> },
  ]);
}

const LandingPage = Loadable(lazy(() => import("../pages/LandingPage")));
const GeneralApp = Loadable(lazy(() => import("../pages/dashboard/GeneralApp")));
const GroupsPage = Loadable(lazy(() => import("../pages/dashboard/GroupsPage")));
const CallHistoryPage = Loadable(lazy(() => import("../pages/dashboard/CallHistoryPage")));
const SettingsPage = Loadable(lazy(() => import("../pages/dashboard/SettingsPage")));
const TasksPage = Loadable(lazy(() => import("../pages/dashboard/TasksPage")));
const AdminDashboard = Loadable(lazy(() => import("../pages/dashboard/AdminDashboard")));
const Page404 = Loadable(lazy(() => import("../pages/Page404")));
const ForgotPasswordPage = Loadable(lazy(() => import("../pages/auth/ForgotPasswordPage")));
const OTPVerificationPage = Loadable(lazy(() => import("../pages/auth/OTPVerificationPage")));
const ResetPasswordPage = Loadable(lazy(() => import("../pages/auth/ResetPasswordPage")));
