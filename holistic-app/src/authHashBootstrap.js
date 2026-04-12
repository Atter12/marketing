/**
 * Handoff mismo-navegador (ej. hecom.club → marketing): fragmento tipo implicit grant
 * (#access_token=…&refresh_token=…). Debe ejecutarse después de createClient y antes de montar React,
 * para que localStorage tenga sesión antes de AuthGate y para no competir con detectSessionInUrl.
 */
export async function consumeAuthHashIfPresent(client) {
  if (typeof window === "undefined" || !client) return;
  const raw = window.location.hash || "";
  if (!raw.includes("access_token")) return;
  let params;
  try {
    params = new URLSearchParams(raw.startsWith("#") ? raw.slice(1) : raw);
  } catch {
    return;
  }
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return;
  try {
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) console.warn("[authHashBootstrap] setSession:", error.message);
  } catch (e) {
    console.warn("[authHashBootstrap]", e);
  }
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", pathname + (search || ""));
}
