// Sonde chaque composant de status.config.json et met à jour le fichier d'historique.
// Lancé par .github/workflows/probe.yml (toutes les 5 min, hors de la machine Serverako).
// Usage : node scripts/probe.mjs <status.config.json> <status.json>
import { readFile, writeFile } from 'node:fs/promises';
import { renderMail, STATUS_URL } from './mail.mjs';

const [configPath, dataPath] = process.argv.slice(2);
if (!configPath || !dataPath) {
  console.error('usage : node scripts/probe.mjs <config> <data>');
  process.exit(2);
}

const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 5_000;
const RECENT_HOURS = 24;
const KEEP_DAYS = 90;

const { components } = JSON.parse(await readFile(configPath, 'utf8'));
const data = await readFile(dataPath, 'utf8')
  .then((t) => JSON.parse(t))
  .catch(() => ({}));
data.components ??= {};
data.recent ??= [];
data.days ??= {};

const passes = (expect, code) => (expect === 'edge' ? code > 0 && code < 500 : code === 200);

async function attempt(c) {
  const started = performance.now();
  try {
    const res = await fetch(c.url, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'user-agent': 'serverako-status (+https://status.serverako.com)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    return { code: res.status, ms: Math.round(performance.now() - started) };
  } catch {
    return { code: 0, ms: null };
  }
}

/** Un composant est en panne seulement si deux essais à 5 s d'écart échouent (pas d'alerte sur un raté isolé). */
async function probe(c) {
  let r = await attempt(c);
  if (!passes(c.expect, r.code)) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    r = await attempt(c);
  }
  return { ...r, up: passes(c.expect, r.code) };
}

const now = new Date();
const t = now.toISOString();
const day = t.slice(0, 10);
const results = await Promise.all(components.map(async (c) => [c.id, await probe(c)]));

const sample = { t, r: {} };
const transitions = [];
data.days[day] ??= {};
for (const [id, r] of results) {
  const previous = data.components[id];
  const state = r.up ? 'up' : 'down';
  if (previous && previous.state !== state) transitions.push({ id, state, code: r.code, since: previous.since });
  data.components[id] = {
    state,
    since: previous?.state === state ? previous.since : t,
    code: r.code,
    latencyMs: r.ms,
    checkedAt: t,
  };
  sample.r[id] = r.up ? 1 : 0;
  const [up, total] = data.days[day][id] ?? [0, 0];
  data.days[day][id] = [up + (r.up ? 1 : 0), total + 1];
  console.log(`${r.up ? 'OK  ' : 'DOWN'} ${id} ${r.code} ${r.ms ?? '-'} ms`);
}

const recentFrom = now.getTime() - RECENT_HOURS * 3600_000;
data.recent = [...data.recent, sample].filter((s) => Date.parse(s.t) >= recentFrom);
const oldestDay = new Date(now.getTime() - KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
for (const d of Object.keys(data.days)) if (d < oldestDay) delete data.days[d];
// Composants retirés de la configuration : plus affichés, donc plus gardés.
const ids = new Set(components.map((c) => c.id));
for (const id of Object.keys(data.components)) if (!ids.has(id)) delete data.components[id];

data.updatedAt = t;
await writeFile(dataPath, JSON.stringify(data) + '\n');

// --- Alertes par email (Brevo), seulement quand un composant change d'état ---------------------

const names = Object.fromEntries(components.map((c) => [c.id, c.name]));
const clock = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Indian/Antananarivo',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const duration = (fromIso) => {
  const minutes = Math.max(1, Math.round((now.getTime() - Date.parse(fromIso)) / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
};
const reason = (code) => (code === 0 ? 'pas de réponse en 10 s' : `réponse HTTP ${code}`);

function block(tr) {
  return tr.state === 'down'
    ? { alert: `**${names[tr.id]}** : en panne (${reason(tr.code)}, deux essais à 5 s d'écart)` }
    : { ok: `**${names[tr.id]}** : rétabli après ${duration(tr.since)} de panne` };
}

async function sendEmail({ subject, title, blocks }) {
  const key = process.env.BREVO_APIKEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  const to = (process.env.ALERT_TO ?? '').split(',').map((a) => a.trim()).filter(Boolean);
  if (!key || !sender || to.length === 0) {
    console.log('Email non envoyé : secrets BREVO_APIKEY, BREVO_SENDER_EMAIL ou ALERT_TO absents.');
    return;
  }
  const { html, text } = renderMail({
    preheader: subject,
    title,
    blocks: [...blocks, { button: 'Page de statut', url: STATUS_URL }],
    note: `Mesure du ${clock.format(now)} (heure de Madagascar), depuis GitHub Actions.`,
  });
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: sender, name: 'Serverako — statut' },
      to: to.map((email) => ({ email })),
      subject: `[Serverako] ${subject}`,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo a répondu ${res.status} : ${(await res.text()).slice(0, 200)}`);
  console.log(`Email envoyé à ${to.length} destinataire(s) : ${subject}`);
}

try {
  if (process.env.TEST_EMAIL === 'true') {
    await sendEmail({
      subject: 'Test des alertes de la page de statut',
      title: 'Les alertes fonctionnent',
      blocks: [
        'Ceci est un email de test : vous recevrez un email quand un composant tombe en panne, puis quand il est rétabli.',
        { rows: results.map(([id, r]) => [names[id], r.up ? 'Opérationnel' : 'En panne']) },
      ],
    });
  } else if (transitions.length > 0) {
    const down = transitions.filter((tr) => tr.state === 'down');
    const stillDown = results.filter(([id, r]) => !r.up && !transitions.some((tr) => tr.id === id));
    await sendEmail({
      subject:
        down.length > 0
          ? `Panne : ${down.map((tr) => names[tr.id]).join(', ')}`
          : `Rétabli : ${transitions.map((tr) => names[tr.id]).join(', ')}`,
      title: down.length > 0 ? 'Panne détectée' : 'Service rétabli',
      blocks: [
        ...transitions.map(block),
        ...stillDown.map(([id]) => ({ alert: `**${names[id]}** : toujours en panne` })),
      ],
    });
  }
} catch (error) {
  // Mesures déjà écrites : le workflow les publie quand même (if: always()) puis échoue,
  // ce qui déclenche aussi la notification d'échec de GitHub.
  console.error(`Échec de l'envoi de l'alerte : ${error.message}`);
  process.exitCode = 1;
}
