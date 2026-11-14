
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Materials from "./pages/Materials";
import Lots from "./pages/Lots";
import Stock from "./pages/Stock";
import Receive from "./pages/Receive";
import Use from "./pages/Use";
import Movements from "./pages/Movements";
import Users from "./pages/Users";
import AuditTrail from "./pages/AuditTrail";
import Login from "./pages/Login";
import "./styles/global.css";

function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "Admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/lots" element={<Lots />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/receive" element={<Receive />} />
          <Route path="/use" element={<Use />} />
          <Route path="/movements" element={<Movements />} />

          <Route
            path="/users"
            element={
              <ProtectedRoute adminOnly>
                <Users />
              </ProtectedRoute>
            }
          />

          <Route
            path="/audit"
            element={
              <ProtectedRoute adminOnly>
                <AuditTrail />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
