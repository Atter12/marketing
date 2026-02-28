import { useState } from "react";
import { Lock, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { solicitarMagicLink } from "./supabase";

const inputStyle = { width: "100%", padding: "12px 14px", border: "1px solid #e2e4e9", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

export default function Login({ onSuccess, supabase }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkEnviado, setLinkEnviado] = useState(false);

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
    setLoading(true);
    try {
      const redirectTo = typeof window !== "undefined" ? window.location.origin + (window.location.pathname || "") : null;
      await solicitarMagicLink(correo, { redirect_to: redirectTo || undefined });
      setLinkEnviado(true);
    } catch (err) {
      setError(err?.message || "Error al enviar el enlace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0f111a 0%, #1a1d26 50%, #0f111a 100%)", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #1b2559 0%, #0055ff 100%)", padding: "32px 28px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 14px", background: "rgba(255,255,255,.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={28} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>Holistic Marketing</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.85)" }}>Gerente o cliente</p>
        </div>

        {linkEnviado && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 28px 0", padding: "12px 14px", background: "#eafaf4", color: "#0d9f6e", borderRadius: 10, fontSize: 13 }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>Revisá tu correo. Abrí el enlace para entrar al panel.</span>
          </div>
        )}

        <form onSubmit={handleEnviarLink} style={{ padding: "28px 28px 32px" }}>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", marginBottom: 18, background: "#fdf0f2", color: "#dc2640", borderRadius: 10, fontSize: 13 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Correo</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9498a8" }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" style={{ ...inputStyle, paddingLeft: 44 }} />
            </div>
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", border: "none", borderRadius: 10, background: loading ? "#9498a8" : "#1b2559", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Enviando…" : "Enviar enlace al correo"}
          </button>
        </form>
      </div>
    </div>
  );
}
