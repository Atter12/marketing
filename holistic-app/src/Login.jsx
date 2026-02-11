import { useState } from "react";
import { Lock, Mail, AlertCircle } from "lucide-react";

export default function Login({ onSuccess, supabase }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!supabase) {
      setError("App no configurada. Faltan PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signError) {
        setError(signError.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : signError.message);
        setLoading(false);
        return;
      }
      const userEmail = data.user?.email ?? "";
      const { data: gerente, error: gerenteError } = await supabase
        .from("gerentes")
        .select("email")
        .ilike("email", userEmail)
        .maybeSingle();
      if (gerenteError) {
        console.error("[Login] Error al verificar gerente:", gerenteError);
        await supabase.auth.signOut();
        setError("Error al verificar acceso. Revisa la consola (F12).");
        setLoading(false);
        return;
      }
      if (!gerente) {
        await supabase.auth.signOut();
        setError("No autorizado. Solo el gerente puede acceder.");
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (err) {
      console.error("[Login] Error:", err);
      setError(err?.message || "Error al iniciar sesión.");
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>Acceso gerente</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.85)" }}>Solo personal autorizado</p>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "28px 28px 32px" }}>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", marginBottom: 18, background: "#fdf0f2", color: "#dc2640", borderRadius: 10, fontSize: 13 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Correo</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9498a8" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                autoComplete="email"
                style={{ width: "100%", padding: "12px 14px 12px 44px", border: "1px solid #e2e4e9", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e4e9", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "14px", border: "none", borderRadius: 10, background: loading ? "#9498a8" : "#1b2559", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
