import { useState, useEffect } from "react";
import { supabase, isGerente, getClientIdForUser } from "./supabase";
import Login from "./Login";
import App from "./App";

const statuses = { loading: "loading", login: "login", app: "app", unauthorized: "unauthorized" };

export default function AuthGate() {
  const [status, setStatus] = useState(statuses.loading);
  const [role, setRole] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setStatus(statuses.login);
      return;
    }

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setStatus(statuses.login);
        setRole(null);
        setClientId(null);
        setUserEmail(null);
        return;
      }
      const email = session.user?.email ?? null;
      setUserEmail(email);
      const ok = await isGerente();
      if (ok) {
        setStatus(statuses.app);
        setRole("gerente");
        setClientId(null);
        return;
      }
      const cid = await getClientIdForUser();
      if (cid) {
        setStatus(statuses.app);
        setRole("cliente");
        setClientId(cid);
        return;
      }
      console.warn("[AuthGate] Sin rol gerente ni cliente.");
      await supabase.auth.signOut();
      setStatus(statuses.unauthorized);
      setRole(null);
      setClientId(null);
      setUserEmail(null);
    };

    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => check());
    return () => subscription?.unsubscribe();
  }, []);

  const onLoginSuccess = (payload) => {
    setStatus(statuses.app);
    setRole(payload?.role ?? "gerente");
    setClientId(payload?.clientId ?? null);
    setUserEmail(payload?.userEmail ?? null);
  };

  if (status === statuses.loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f111a", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ color: "#9498a8", fontSize: 14 }}>Cargando…</div>
      </div>
    );
  }

  if (status === statuses.unauthorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0f111a 0%, #1a1d26 100%)", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <p style={{ color: "#f4f5f7", fontSize: 16, marginBottom: 20 }}>No autorizado. Acceso solo para gerente o clientes con cuenta.</p>
          <button
            onClick={() => setStatus(statuses.login)}
            style={{ padding: "12px 24px", border: "none", borderRadius: 10, background: "#1b2559", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  if (status === statuses.login) {
    return <Login supabase={supabase} onSuccess={onLoginSuccess} />;
  }

  return <App role={role} clientId={clientId} userEmail={userEmail} />;
}
