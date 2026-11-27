// Gabarit des emails, aux couleurs de la charte : même structure et mêmes couleurs que
// apps/api/src/mail/template.ts (repo server-rak) — bandeau vert sapin avec le logo blanc, filet
// turquoise, carte blanche, titres sapin, encadrés d'alerte. Thème clair, jamais de texte turquoise.
// Le logo est servi par cette page de statut (Vercel) : il s'affiche même quand la plateforme est coupée.

export const STATUS_URL = 'https://status.serverako.com';
const LOGO = `${STATUS_URL}/email/serverako-logo-white.png`;

const C = {
  canvas: '#EFEFEF',
  sapin: '#1B473F',
  turquoise: '#62C6C1',
  text: '#1E1E1E',
  muted: '#2E7064',
  border: '#E2E2E2',
  error: '#CD2B31',
};
const FONT = `'Rosa Sans', Montserrat, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) =>
  escape(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.sapin};font-weight:600">$1</strong>`);
const plain = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1');

const box = (background, border, content) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr><td style="background:${background};border-left:4px solid ${border};border-radius:6px;padding:12px 16px;font-size:14px;line-height:22px;color:${C.text}">${inline(content)}</td></tr></table>`;

/**
 * Blocs : chaîne (paragraphe, `**gras**` permis), `{ alert }` (encadré rouge), `{ ok }` (encadré sapin),
 * `{ rows: [[libellé, valeur]] }`, `{ button, url }`.
 */
function blockHtml(b) {
  if (typeof b === 'string')
    return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.text}">${inline(b)}</p>`;
  if ('alert' in b) return box('#FDF0F0', C.error, b.alert);
  if ('ok' in b) return box('#EEF7F6', C.muted, b.ok);
  if ('rows' in b)
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-top:1px solid ${C.border}">${b.rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.border};font-size:14px;color:${C.muted}">${escape(k)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${C.border};font-size:14px;font-weight:600;color:${C.sapin}">${escape(v)}</td></tr>`,
      )
      .join('')}</table>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${C.sapin};border-radius:8px"><a href="${escape(b.url)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none">${escape(b.button)} &rarr;</a></td></tr></table>`;
}

function blockText(b) {
  if (typeof b === 'string') return plain(b);
  if ('alert' in b) return `⚠ ${plain(b.alert)}`;
  if ('ok' in b) return `✓ ${plain(b.ok)}`;
  if ('rows' in b) return b.rows.map(([k, v]) => `${k} : ${v}`).join('\n');
  return `${b.button} : ${b.url}`;
}

/** { html, text } d'un email : `preheader` (aperçu de la boîte de réception), `title`, `blocks`, `note`. */
export function renderMail({ preheader, title, blocks, note }) {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:${FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${C.sapin};border-radius:14px 14px 0 0;padding:24px 32px"><img src="${LOGO}" width="160" height="27" alt="Serverako" style="display:block;border:0;color:#FFFFFF;font-family:Montserrat,${FONT};font-size:22px;font-weight:800"></td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${C.turquoise}">&nbsp;</td></tr>
<tr><td style="background:#FFFFFF;border-radius:0 0 14px 14px;padding:32px 32px 16px;font-family:${FONT}">
<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:700;color:${C.sapin}">${escape(title)}</h1>
${blocks.map(blockHtml).join('\n')}
</td></tr>
<tr><td style="padding:20px 32px 0;font-size:12px;line-height:18px;color:${C.muted};text-align:center">
${note ? `${escape(note)}<br>` : ''}Serverako — page de statut<br><a href="${STATUS_URL}" style="color:${C.sapin};text-decoration:underline">status.serverako.com</a>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, ...blocks.map(blockText), ...(note ? [note] : []), '— Serverako'].join('\n\n');
  return { html, text };
}
