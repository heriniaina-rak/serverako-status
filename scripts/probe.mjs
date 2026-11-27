// Sonde chaque composant de status.config.json et met à jour le fichier d'historique.
// Lancé par .github/workflows/probe.yml (toutes les 5 min, hors de la machine Serverako).
// Usage : node scripts/probe.mjs <status.config.json> <status.json>
import { readFile, writeFile } from 'node:fs/promises';

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
data.days[day] ??= {};
for (const [id, r] of results) {
  const previous = data.components[id];
  const state = r.up ? 'up' : 'down';
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
