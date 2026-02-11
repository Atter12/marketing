import { useState, useEffect } from "react";
import { supabase, isGerente } from "./supabase";
import Login from "./Login";
import App from "./App";

const statuses = {
  loading: "loading",
  login: "login",
  app: "app",
  unauthorized: "unauthorized",
};

export default function AuthGate() {
  const [status, setStatus] = useState(statuses.loading);

  useEffect(() => {
    if (!supabase) {
      setStatus(statuses.login);
      return;
    }

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setStatus(statuses.login);
        return;
      }
      const ok = await isGerente();
      if (ok) {
        setStatus(statuses.app);
        return;
      }
      console.warn("[AuthGate] Usuario no está en gerentes, cerrando sesión.");
      await supabase.auth.signOut();
      setStatus(statuses.unauthorized);
    };

    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => check());
    return () => subscription?.unsubscribe();
  }, []);

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
          <p style={{ color: "#f4f5f7", fontSize: 16, marginBottom: 20 }}>No autorizado. Solo el gerente puede acceder.</p>
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
    return <Login supabase={supabase} onSuccess={() => setStatus(statuses.app)} />;
  }

  return <App />;
}
