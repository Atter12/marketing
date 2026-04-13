import { useState, useEffect, useRef } from "react";
import { supabase, isGerente, getClientIdForUser } from "./supabase";
import { isAuthBootstrapDebugEnabled, logAuthLine } from "./authDebug.js";
import Login from "./Login";
import App from "./App";

const statuses = { loading: "loading", login: "login", app: "app", unauthorized: "unauthorized" };
/** Contador largo post-check: isGerente / DB pueden tardar; el gate ya no compite con el hash (main.jsx). */
const LOADING_TIMEOUT_MS = 20000;
const SESSION_RETRY_MS = 400;
const SESSION_RETRIES = 8;

export default function AuthGate() {
  const [status, setStatus] = useState(statuses.loading);
  const [role, setRole] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const mounted = useRef(true);
  const timeoutRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    if (!supabase) {
      setStatus(statuses.login);
      return;
    }

    const clearLoadingTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const resolveAuthUser = async () => {
      for (let attempt = 0; attempt < SESSION_RETRIES; attempt++) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.warn("[AuthGate] getSession error:", error.message);
        if (session?.user?.email) return session.user;
        if (attempt < SESSION_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, SESSION_RETRY_MS));
        }
      }
      const { data: { user }, error: uerr } = await supabase.auth.getUser();
      if (uerr) console.warn("[AuthGate] getUser error:", uerr.message);
      if (!user?.email) {
        logAuthLine("[AuthGate] no session/user after retries", { attempts: SESSION_RETRIES });
      }
      return user ?? null;
    };

    const check = async () => {
      try {
        const user = await resolveAuthUser();
        if (!mounted.current) return;
        if (!user?.email) {
          setStatus(statuses.login);
          setRole(null);
          setClientId(null);
          setUserEmail(null);
          return;
        }
        const email = user.email;
        setUserEmail(email);
        let ok = false;
        try {
          ok = await isGerente();
        } catch (ge) {
          console.warn("[AuthGate] isGerente threw:", ge?.message || ge);
        }
        if (!mounted.current) return;
        if (ok) {
          setStatus(statuses.app);
          setRole("gerente");
          setClientId(null);
          return;
        }
        let cid = null;
        try {
          cid = await getClientIdForUser();
        } catch (ce) {
          console.warn("[AuthGate] getClientIdForUser threw:", ce?.message || ce);
        }
        if (!mounted.current) return;
        if (cid) {
          setStatus(statuses.app);
          setRole("cliente");
          setClientId(cid);
          return;
        }
        logAuthLine("[AuthGate] Sin rol gerente ni cliente", {
          email,
          isGerente: ok,
          clientIdResolved: !!cid,
          verbose: isAuthBootstrapDebugEnabled(),
        });
        await supabase.auth.signOut();
        if (!mounted.current) return;
        setStatus(statuses.unauthorized);
        setRole(null);
        setClientId(null);
        setUserEmail(null);
      } catch (err) {
        console.error("[AuthGate] check error:", err);
        if (!mounted.current) return;
        setStatus(statuses.login);
        setRole(null);
        setClientId(null);
        setUserEmail(null);
      }
    };

    const run = async () => {
      clearLoadingTimeout();
      try {
        await check();
      } catch (e) {
        console.error("[AuthGate] run check:", e);
      }
      if (!mounted.current) return;
      timeoutRef.current = window.setTimeout(() => {
        setStatus((s) => {
          if (s === statuses.loading) return statuses.login;
          return s;
        });
      }, LOADING_TIMEOUT_MS);
    };

    void run();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearLoadingTimeout();
        setStatus(statuses.login);
        setRole(null);
        setClientId(null);
        setUserEmail(null);
        return;
      }
      void run();
    });

    return () => {
      mounted.current = false;
      clearLoadingTimeout();
      subscription?.unsubscribe();
    };
  }, []);

  const onLoginSuccess = (payload) => {
    setStatus(statuses.app);
    setRole(payload?.role ?? "gerente");
    setClientId(payload?.clientId ?? null);
    setUserEmail(payload?.userEmail ?? null);
  };

  if (status === statuses.loading) {
    // Mismo tono que Login (#fff) para evitar parpadeo negro → blanco al resolver auth.
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>Cargando…</div>
      </div>
    );
  }

  if (status === statuses.unauthorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0f111a 0%, #1a1d26 100%)", fontFamily: "'Inter', sans-serif", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <p style={{ color: "#f4f5f7", fontSize: 16, marginBottom: 20 }}>No autorizado. Acceso solo para gerente o clientes con cuenta.</p>
          <button
            onClick={() => setStatus(statuses.login)}
            style={{ padding: "12px 24px", border: "none", borderRadius: 10, background: "#ea580c", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
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
