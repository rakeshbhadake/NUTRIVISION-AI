import { useEffect, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
} from "react-router-dom";
import { Leaf } from "lucide-react";
import { useAuth } from "./contexts/AuthContext";
import { ScanProvider } from "./contexts/ScanContext";
import AppLayout from "./layouts/AppLayout";
const page = (load, name) =>
  lazy(() => load().then((module) => ({ default: module[name] })));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Scan = lazy(() => import("./pages/Scan"));
const History = lazy(() => import("./pages/History"));
const CameraCapture = page(() => import("./pages/Scan"), "CameraCapture");
const AnalysisResults = page(() => import("./pages/Scan"), "AnalysisResults");
const DailyTracker = page(() => import("./pages/History"), "DailyTracker");
const Landing = page(() => import("./pages/Public"), "Landing");
const Login = page(() => import("./pages/Public"), "Login");
const Signup = page(() => import("./pages/Public"), "Signup");
const ForgotPassword = page(() => import("./pages/Public"), "ForgotPassword");
const ResetPassword = page(() => import("./pages/Public"), "ResetPassword");
const VerifyEmail = page(() => import("./pages/Public"), "VerifyEmail");
const About = page(() => import("./pages/Public"), "About");
const Analytics = page(() => import("./pages/Features"), "Analytics");
const Goals = page(() => import("./pages/Features"), "Goals");
const Water = page(() => import("./pages/Features"), "Water");
const Assistant = page(() => import("./pages/Features"), "Assistant");
const Recipes = page(() => import("./pages/Features"), "Recipes");
const Profile = page(() => import("./pages/Features"), "Profile");
const Settings = page(() => import("./pages/Features"), "Settings");
const AdminDashboard = page(() => import("./pages/Features"), "AdminDashboard");
const AdminUsers = page(() => import("./pages/Features"), "AdminUsers");
const AdminFoods = page(() => import("./pages/Features"), "AdminFoods");
const AdminPerformance = page(
  () => import("./pages/Features"),
  "AdminPerformance",
);
const AdminSubscriptions = page(
  () => import("./pages/Features"),
  "AdminSubscriptions",
);
import { Card, Button, EmptyState, Spinner } from "./components/ui";
import "./pages/feature-pages.css";

function Protected({ admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Opening your wellness space…" />;
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && !user.is_staff) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default function App() {
  return (
    <ScanProvider>
      <ScrollReset />
      <Suspense fallback={<Spinner label="Opening your wellness space…" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route element={<Protected />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/camera" element={<CameraCapture />} />
              <Route path="/analysis" element={<AnalysisResults />} />
              <Route path="/tracker" element={<DailyTracker />} />
              <Route path="/history" element={<History />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/water" element={<Water />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route element={<Protected admin />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/foods" element={<AdminFoods />} />
                <Route
                  path="/admin/performance"
                  element={<AdminPerformance />}
                />
                <Route
                  path="/admin/subscriptions"
                  element={<AdminSubscriptions />}
                />
              </Route>
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <main className="not-found">
                <Card>
                  <EmptyState
                    icon={Leaf}
                    title="Let’s get you back on track"
                    description="That page isn’t part of your wellness space."
                    action={
                      <Button asChild>
                        <Link to="/dashboard">Back to your day</Link>
                      </Button>
                    }
                  />
                </Card>
              </main>
            }
          />
        </Routes>
      </Suspense>
    </ScanProvider>
  );
}
