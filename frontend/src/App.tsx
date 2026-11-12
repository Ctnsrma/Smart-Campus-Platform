import { useCallback, useState } from "react";
import AuthForm from "./components/AuthForm";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const logout = useCallback(() => setToken(null), []);

  return token ? <Dashboard token={token} onLogout={logout} /> : <AuthForm onLogin={setToken} />;
}