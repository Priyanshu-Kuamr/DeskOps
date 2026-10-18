import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getCurrentUser, logoutUser } from "./api/client";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./Dashboard";

export default function AuthGate() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const profile = await getCurrentUser();
      setUser(profile);
    } catch {
      logoutUser();
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem("opsflow_token")) {
      checkSession();
    } else {
      setChecking(false);
    }
  }, [checkSession]);

  async function handleLogin() {
    setChecking(true);
    await checkSession();
  }

  function handleLogout() {
    logoutUser();
    setUser(null);
  }

  if (checking) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
        <p>Loading your workspace...</p>
      </div>
    );
  }

  if (!user) {
    if (location.pathname === "/register") {
      return <Register />;
    }

    if (location.pathname === "/login" || location.pathname === "/") {
      return <Login onLogin={handleLogin} />;
    }

    return <Navigate to="/login" replace />;
  }

  if (location.pathname === "/login" || location.pathname === "/register") {
    return <Navigate to="/" replace />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
