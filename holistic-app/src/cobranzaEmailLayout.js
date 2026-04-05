/**
 * Plantilla HTML del correo de cobranza (envoltorio Resend).
 * Mantener alineado con holistic-app/supabase/functions/cobranza-enviar/index.ts → buildCobranzaEmail (solo parte html).
 */

export function escapeHtmlCobranza(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** URL absoluta del logo para la vista previa (mismo origen que la app). */
export function defaultCobranzaLogoUrlForPreview() {
  if (typeof window === "undefined") return "";
  const fromEnv = (import.meta.env.VITE_COBRANZA_LOGO_URL || "").trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") || "";
  const path = `${base}/logo/logoh.png`.replace(/\/+/g, "/");
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function defaultCobranzaPanelUrlForPreview() {
  if (typeof window === "undefined") return "https://www.marketingconholistic.com/credito";
  const fromEnv = (import.meta.env.VITE_COBRANZA_PANEL_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `${window.location.origin}/credito`;
}

export function cobranzaBrandNameForPreview() {
  return (import.meta.env.VITE_COBRANZA_BRAND_NAME || "Holistic Marketing").trim();
}

export function cobranzaTaglineForPreview() {
  return (import.meta.env.VITE_COBRANZA_TAGLINE || "Marketing digital · Gestión de cuentas").trim();
}

/**
 * Misma estructura visual que el correo real (cabecera, cuerpo editable, firma, CTA, pie).
 * @param {object} opts
 * @param {string} opts.innerHtml - cuerpo HTML del borrador (ya escapado o confiable)
 * @param {string} opts.brandName
 * @param {string} opts.panelUrl
 * @param {string|null} opts.logoUrl - URL absoluta https o http (preview); vacío = sin imágenes
 * @param {string} opts.tagline
 */
export function buildCobranzaWrappedPreviewHtml(opts) {
  const brand = escapeHtmlCobranza(opts.brandName);
  const taglineEsc = escapeHtmlCobranza(opts.tagline);
  const panel = String(opts.panelUrl || "").replace(/\/$/, "");
  const panelEsc = escapeHtmlCobranza(panel);
  const rawLogo = (opts.logoUrl || "").trim();
  const logoSafe =
    rawLogo && /^https?:\/\//i.test(rawLogo) ? escapeHtmlCobranza(rawLogo) : "";
  const logoBlock = logoSafe
    ? `<img src="${logoSafe}" width="140" alt="${brand}" style="display:block;max-width:140px;height:auto;border:0;margin:0 0 12px 0;" />`
    : "";
  const headerInner = logoSafe
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:12px;width:100%;"><tr><td style="vertical-align:middle;padding-right:16px;width:1%;"><img src="${logoSafe}" width="120" alt="" style="display:block;max-width:120px;height:auto;border:0;" /></td><td style="vertical-align:middle;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.03em;line-height:1.2;">${brand}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.88);margin-top:8px;line-height:1.45;">${taglineEsc}</div>
        </td></tr></table>`
    : `<div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:10px;letter-spacing:-.03em;line-height:1.2;">${brand}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.88);margin-top:8px;line-height:1.45;">${taglineEsc}</div>`;

  const inner = opts.innerHtml && String(opts.innerHtml).trim() ? opts.innerHtml : "<p>(sin contenido)</p>";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 14px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.08);border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:26px 28px;background:linear-gradient(135deg,#1b2559 0%,#2d3a6e 100%);">
          <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);font-weight:600;">Comunicación oficial</div>
          ${headerInner}
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;color:#0f172a;font-size:15px;line-height:1.65;">
          ${inner}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 20px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 22px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;background:#fafafa;padding:18px 20px;">
            <tr><td>
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;">Firma</p>
              ${logoBlock}
              <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${brand}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#64748b;line-height:1.5;">${taglineEsc}</p>
              <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;line-height:1.45;">Correo enviado de forma segura desde el panel Crédito.</p>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <p style="margin:0 0 14px;font-size:13px;color:#64748b;line-height:1.5;">¿Necesitás ver tu cuenta o subir un comprobante?</p>
          <a href="${panelEsc}" style="display:inline-block;padding:12px 22px;background:#1b2559;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Entrar al panel Crédito</a>
          <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">Si no reconocés este mensaje, podés ignorarlo o responder a este correo.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;text-align:center;">© ${brand} · Este correo es transaccional.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
