import { useState, useEffect, useRef } from "react";
import { getSupabase, isGerente, getClientIdForUser } from "./supabase";
import { isAuthBootstrapDebugEnabled, logAuthLine } from "./authDebug.js";
import App from "./App";

const statuses = { loading: "loading", app: "app", unauthorized: "unauthorized" };

/** Igual contrato que `credito.html` → `redirectLogin`: un solo login en hecom.club. */
export function redirectToCentralLogin() {
  if (typeof window === "undefined") return;
  try {
    const path = window.location.pathname || "/";
    const full = `${path}${window.location.search || ""}${window.location.hash || ""}`;
    sessionStorage.setItem("hecom_intended_path_after_login", full.startsWith("/") ? full : `/${full}`);
  } catch {
    /* ignore */
  }
  window.location.replace("https://www.hecom.club/login");
}

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
  /** Evita redirigir al login central cuando hicimos signOut para mostrar pantalla "No autorizado". */
  const skipCentralLoginOnNextSignOutRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const supabase = getSupabase();
    if (!supabase) {
      redirectToCentralLogin();
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
          redirectToCentralLogin();
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
        logAuthLine("[AuthGate] unauthorized next", {
          hint: "Sesión válida pero el email no está en gerentes ni en clientes_acceso (o RLS bloqueó la lectura). UI clara abajo.",
        });
        skipCentralLoginOnNextSignOutRef.current = true;
        await supabase.auth.signOut();
        if (!mounted.current) return;
        setStatus(statuses.unauthorized);
        setRole(null);
        setClientId(null);
        setUserEmail(null);
      } catch (err) {
        console.error("[AuthGate] check error:", err);
        if (!mounted.current) return;
        redirectToCentralLogin();
      }
    };

    const run = async () => {
      clearLoadingTimeout();
      try {
        await check();
      } catch (e) {
        console.error("[AuthGate] run check:", e);
        if (mounted.current) redirectToCentralLogin();
      }
      if (!mounted.current) return;
      timeoutRef.current = window.setTimeout(() => {
        if (!mounted.current) return;
        setStatus((s) => {
          if (s === statuses.loading) {
            redirectToCentralLogin();
          }
          return s;
        });
      }, LOADING_TIMEOUT_MS);
    };

    void run();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearLoadingTimeout();
        setRole(null);
        setClientId(null);
        setUserEmail(null);
        if (skipCentralLoginOnNextSignOutRef.current) {
          skipCentralLoginOnNextSignOutRef.current = false;
          return;
        }
        redirectToCentralLogin();
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

  useEffect(() => {
    if (status !== statuses.app || typeof window === "undefined") return;
    const path = window.location.pathname || "";
    if (path === "/credito" || path.startsWith("/credito/")) {
      logAuthLine("[AuthGate] ok", { role, hasClientId: !!clientId, email: userEmail || null });
    }
  }, [status, role, clientId, userEmail]);

  if (status === statuses.loading) {
    // Mismo tono que la pantalla de login principal (#fff) para evitar parpadeo.
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>Cargando…</div>
      </div>
    );
  }

  if (status === statuses.unauthorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f3ee", fontFamily: "'Inter', sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "28px 24px", boxShadow: "0 8px 30px rgba(15,23,42,.08)" }}>
          <p style={{ color: "#1f2937", fontSize: 16, fontWeight: 600, marginBottom: 10 }}>No autorizado</p>
          <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
            Tu sesión es válida, pero este correo no tiene panel en Crédito: tiene que existir en <strong>gerentes</strong> o en <strong>clientes_acceso</strong> (y la política RLS tiene que permitir leerlo). Si acabás de recibir el acceso, pedí que verifiquen la fila en Supabase.
          </p>
          <button
            type="button"
            onClick={() => redirectToCentralLogin()}
            style={{ padding: "12px 24px", border: "none", borderRadius: 10, background: "#ea580c", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return <App role={role} clientId={clientId} userEmail={userEmail} />;
}
