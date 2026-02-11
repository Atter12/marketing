import { useState } from "react";
import { Lock, Mail, AlertCircle, UserPlus, CheckCircle } from "lucide-react";
import { getClientIdForUser } from "./supabase";

const inputStyle = { width: "100%", padding: "12px 14px", border: "1px solid #e2e4e9", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

export default function Login({ onSuccess, supabase }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signupOk, setSignupOk] = useState(false);

  async function tryEnter(data) {
    const userEmail = data.user?.email ?? "";
    const { data: gerente, error: gerenteError } = await supabase.from("gerentes").select("email").ilike("email", userEmail).maybeSingle();
    if (gerenteError) return null;
    if (gerente) return { role: "gerente" };
    const clientId = await getClientIdForUser();
    if (clientId) return { role: "cliente", clientId };
    return null;
  }

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
      const result = await tryEnter(data);
      if (result) {
        onSuccess({ ...result, userEmail: data.user?.email ?? "" });
        setLoading(false);
        return;
      }
      await supabase.auth.signOut();
      setError("No autorizado. Sin acceso de gerente ni de cliente.");
    } catch (err) {
      console.error("[Login] Error:", err);
      setError(err?.message || "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");
    setSignupOk(false);
    if (!name.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!supabase) {
      setError("App no configurada.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signError) {
        setError(signError.message === "User already registered" ? "Ese correo ya tiene cuenta. Inicia sesión." : signError.message);
        setLoading(false);
        return;
      }
      if (data?.session) {
        const { error: rpcError } = await supabase.rpc("crear_cliente_desde_registro", {
          p_name: name.trim(),
          p_email: email.trim().toLowerCase(),
        });
        if (rpcError) console.error("[Login] crear_cliente_desde_registro:", rpcError);
        const result = await tryEnter(data);
        if (result) {
          onSuccess(result);
          setLoading(false);
          return;
        }
        await supabase.auth.signOut();
      }
      setSignupOk(true);
      setError("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setMode("login");
    } catch (err) {
      setError(err?.message || "Error al crear cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0f111a 0%, #1a1d26 50%, #0f111a 100%)", fontFamily: "'DM Sans', sans-serif", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #1b2559 0%, #0055ff 100%)", padding: "32px 28px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 14px", background: "rgba(255,255,255,.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {mode === "signup" ? <UserPlus size={28} color="#fff" /> : <Lock size={28} color="#fff" />}
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>Holistic Marketing</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.85)" }}>{mode === "signup" ? "Crear cuenta (cliente)" : "Gerente o cliente"}</p>
        </div>

        {signupOk && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 28px 0", padding: "12px 14px", background: "#eafaf4", color: "#0d9f6e", borderRadius: 10, fontSize: 13 }}>
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>Cuenta creada. Ya puedes iniciar sesión con tu correo y contraseña.</span>
          </div>
        )}

        {mode === "signup" ? (
          <form onSubmit={handleSignUp} style={{ padding: "28px 28px 32px" }}>
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", marginBottom: 18, background: "#fdf0f2", color: "#dc2640", borderRadius: 10, fontSize: 13 }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Nombre</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre o empresa" required autoComplete="name" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Correo</label>
              <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9498a8" }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required autoComplete="email" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Contraseña (mín. 6)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="new-password" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Confirmar contraseña</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete="new-password" style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", border: "none", borderRadius: 10, background: loading ? "#9498a8" : "#0d9f6e", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Creando…" : "Crear cuenta"}
            </button>
            <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#9498a8" }}>
              ¿Ya tienes cuenta?{" "}
              <button type="button" onClick={() => { setMode("login"); setError(""); setSignupOk(false); }} style={{ background: "none", border: "none", color: "#0055ff", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}>Iniciar sesión</button>
            </p>
          </form>
        ) : (
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
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required autoComplete="email" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6577", marginBottom: 6 }}>Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", border: "none", borderRadius: 10, background: loading ? "#9498a8" : "#1b2559", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
            <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#9498a8" }}>
              ¿Eres cliente y no tienes cuenta?{" "}
              <button type="button" onClick={() => { setMode("signup"); setError(""); setSignupOk(false); }} style={{ background: "none", border: "none", color: "#0055ff", fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}>Crear cuenta</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
