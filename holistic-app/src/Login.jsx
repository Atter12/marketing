import { useState, useRef } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { solicitarMagicLink, solicitarCodigoLogin, verificarCodigoLogin } from "./supabase";

const styles = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#ffffff",
    color: "#111827",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    height: 72,
    flexShrink: 0,
  },
  headerLogo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    color: "inherit",
  },
  headerLogoText: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111827",
    letterSpacing: "-0.01em",
  },
  main: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 24px",
  },
  formWrapper: {
    width: "100%",
    maxWidth: 448,
  },
  formHeading: {
    fontSize: 30,
    fontWeight: 600,
    color: "#000000",
    lineHeight: 1.2,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 16,
    fontWeight: 400,
    color: "#6B7280",
    lineHeight: 1.5,
    marginBottom: 32,
  },
  subtitleHighlight: {
    color: "#3B82F6",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputField: {
    width: "100%",
    height: 44,
    padding: "0 14px",
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    background: "#ffffff",
    fontFamily: "inherit",
    fontSize: 16,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 180ms ease, box-shadow 180ms ease",
  },
  inputFieldFocus: {
    borderColor: "#3B82F6",
    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.12)",
  },
  btn: {
    width: "100%",
    height: 44,
    border: "none",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 16,
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "background-color 180ms ease, opacity 180ms ease",
  },
  btnPrimary: {
    background: "#3B82F6",
    color: "#ffffff",
  },
  btnPrimaryHover: { background: "#2563EB" },
  btnPrimaryDisabled: {
    background: "#9CA3AF",
    cursor: "not-allowed",
  },
  hintText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 1.5,
  },
  methodTabs: {
    display: "flex",
    gap: 0,
    marginBottom: 20,
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
    background: "#F9FAFB",
  },
  methodTab: {
    flex: 1,
    padding: "10px 16px",
    border: "none",
    background: "transparent",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 500,
    color: "#6B7280",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  },
  methodTabActive: {
    background: "#ffffff",
    color: "#111827",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  codeInput: {
    width: "100%",
    height: 44,
    padding: "0 14px",
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    background: "#ffffff",
    fontFamily: "inherit",
    fontSize: 20,
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
    textAlign: "center",
    letterSpacing: 6,
  },
  successBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    padding: "12px 14px",
    background: "#ECFDF5",
    color: "#059669",
    borderRadius: 8,
    fontSize: 14,
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    padding: "12px 14px",
    background: "#FEF2F2",
    color: "#DC2626",
    borderRadius: 8,
    fontSize: 14,
  },
  footer: {
    padding: "20px 0",
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
  },
};

function LogoIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width={28} height={28} rx={6} fill="#3B82F6" />
      <path d="M9 8v12M19 8v12M9 14h10" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

export default function Login({ onSuccess, supabase, redirectTo: redirectToProp, variant = "credito" }) {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [method, setMethod] = useState("link"); // "link" | "code"
  const methodRef = useRef("link"); // actualizado al instante al cambiar de pestaña, para evitar que el submit use el valor viejo
  const [inputFocused, setInputFocused] = useState(false);

  async function handleEnviarLink(e) {
    e.preventDefault();
    setError("");
    setLinkEnviado(false);
    if (!supabase) {
      setError("App no configurada. Faltan PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const correo = String(email || "").trim();
    if (!correo || !correo.includes("@")) {
      setError("Indicá un correo válido.");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = redirectToProp || origin + "/credito";
    setLoading(true);
    try {
      await solicitarMagicLink(correo, { redirect_to: redirectTo || undefined });
      setLinkEnviado(true);
    } catch (err) {
      setError(err?.message || "Error al enviar el enlace.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviarCodigo(e) {
    e.preventDefault();
    setError("");
    setCodigoEnviado(false);
    if (!supabase) {
      setError("App no configurada. Faltan PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const correo = String(email || "").trim();
    if (!correo || !correo.includes("@")) {
      setError("Indicá un correo válido.");
      return;
    }
    setLoading(true);
    try {
      await solicitarCodigoLogin(correo);
      await supabase.auth.signInWithOtp({
        email: correo,
        options: { shouldCreateUser: false },
      });
      setCodigoEnviado(true);
      setCodigo("");
    } catch (err) {
      setError(err?.message || "Error al enviar el código.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificarCodigo(e) {
    e.preventDefault();
    setError("");
    if (!supabase) return;
    const correo = String(email || "").trim();
    const cod = String(codigo || "").trim().replace(/\s/g, "");
    if (!cod) {
      setError("Ingresá el código de 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      await verificarCodigoLogin(correo, cod);
      if (onSuccess) onSuccess({ userEmail: correo });
    } catch (err) {
      setError(err?.message || "Código inválido o expirado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <a href="#" style={styles.headerLogo} onClick={(e) => e.preventDefault()}>
          <LogoIcon />
          <span style={styles.headerLogoText}>Holistic Marketing</span>
        </a>
      </header>

      <main style={styles.main}>
        <div style={styles.formWrapper}>
          <h1 style={styles.formHeading}>Iniciar sesión</h1>
          <p style={styles.formSubtitle}>
            {variant === "plataforma"
              ? "Ingresa tu correo para acceder a Creativos y Tareas."
              : <>Ingresa tus credenciales para acceder como <span style={styles.subtitleHighlight}>gerente</span> o <span style={styles.subtitleHighlight}>cliente</span>.</>}
          </p>

          {linkEnviado && method === "link" && (
            <div style={styles.successBox}>
              <CheckCircle size={18} style={{ flexShrink: 0 }} />
              <span>Revisá tu correo. Abrí el enlace para entrar al panel.</span>
            </div>
          )}

          {codigoEnviado ? (
            <form onSubmit={handleVerificarCodigo}>
              {error && (
                <div style={styles.errorBox}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
              <div style={styles.inputGroup}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  style={styles.codeInput}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading || codigo.length < 4}
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  ...(loading || codigo.length < 4 ? styles.btnPrimaryDisabled : {}),
                }}
              >
                {loading ? "Verificando…" : "Verificar código"}
              </button>
              <p style={styles.hintText}>
                ¿No llegó? Revisá spam o{" "}
                <button
                  type="button"
                  onClick={() => { setCodigoEnviado(false); setError(""); }}
                  style={{ background: "none", border: "none", color: "#3B82F6", cursor: "pointer", padding: 0, font: "inherit", textDecoration: "underline" }}
                >
                  pedir otro código
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              (methodRef.current === "link" ? handleEnviarLink : handleEnviarCodigo)(e);
            }}>
              {error && (
                <div style={styles.errorBox}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <div style={styles.methodTabs}>
                <button
                  type="button"
                  onClick={() => { setMethod("link"); methodRef.current = "link"; setError(""); setLinkEnviado(false); }}
                  style={{ ...styles.methodTab, ...(method === "link" ? styles.methodTabActive : {}) }}
                >
                  Enlace al correo
                </button>
                <button
                  type="button"
                  onClick={() => { setMethod("code"); methodRef.current = "code"; setError(""); }}
                  style={{ ...styles.methodTab, ...(method === "code" ? styles.methodTabActive : {}) }}
                >
                  Código de 6 dígitos
                </button>
              </div>

              <div style={styles.inputGroup}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Correo electrónico"
                  required
                  autoComplete="email"
                  style={{
                    ...styles.inputField,
                    ...(inputFocused ? styles.inputFieldFocus : {}),
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  ...(loading ? styles.btnPrimaryDisabled : {}),
                }}
              >
                {loading
                  ? "Enviando…"
                  : method === "link"
                    ? "Enviar enlace al correo"
                    : "Enviar código al correo"}
              </button>

              <p style={styles.hintText}>
                {method === "link"
                  ? "Recibirás un enlace en tu correo. Un clic y entrás."
                  : "Recibirás un código de 6 dígitos para ingresar acá."}
              </p>
            </form>
          )}
        </div>
      </main>

      <footer style={styles.footer}>© 2026 Holistic Marketing</footer>
    </div>
  );
}
