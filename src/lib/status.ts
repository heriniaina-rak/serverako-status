import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { cacheLife } from 'next/cache';
import config from '../../status.config.json';

export type Component = (typeof config.components)[number];
export const COMPONENTS: Component[] = config.components;

type ComponentState = {
  state: 'up' | 'down';
  since: string;
  code: number;
  latencyMs: number | null;
  checkedAt: string;
};
export type StatusData = {
  updatedAt?: string;
  components: Record<string, ComponentState>;
  recent: { t: string; r: Record<string, 0 | 1> }[];
  days: Record<string, Record<string, [up: number, total: number]>>;
};

const DATA_URL =
  process.env.STATUS_DATA_URL ??
  'https://raw.githubusercontent.com/heriniaina-rak/serverako-status/data/status.json';

/** Mesures publiées par les sondes (branche `data`). Pas de cache propre : `getView` (view.ts) est le
 * seul cache, sinon chaque régénération de la page relirait une mesure déjà périmée. */
export async function getStatusData(): Promise<StatusData | null> {
  try {
    // En local : STATUS_DATA_FILE=<status.json produit par scripts/probe.mjs>
    if (process.env.STATUS_DATA_FILE)
      return JSON.parse(await readFile(process.env.STATUS_DATA_FILE, 'utf8')) as StatusData;
    const res = await fetch(DATA_URL, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as StatusData;
  } catch {
    return null;
  }
}

export type Impact = 'major' | 'minor' | 'maintenance';
export type Incident = {
  slug: string;
  title: string;
  impact: Impact;
  components: string[];
  started: string;
  resolved?: string;
  updates: { at: string; label: string; text: string }[];
};

const INCIDENTS_DIR = path.join(process.cwd(), 'incidents');

/** Front matter minimal (`clé: valeur` sur une ligne) : pas de dépendance pour quatre champs. */
function parseIncident(slug: string, source: string): Incident {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`incidents/${slug}.md : front matter manquant`);
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const impact = meta.impact as Impact;
  if (!meta.title || !meta.started || !['major', 'minor', 'maintenance'].includes(impact))
    throw new Error(`incidents/${slug}.md : title, started et impact (major|minor|maintenance) obligatoires`);
  for (const d of [meta.started, meta.resolved].filter(Boolean))
    if (Number.isNaN(Date.parse(d))) throw new Error(`incidents/${slug}.md : date invalide « ${d} »`);

  // Mises à jour : « ## <date ISO> <libellé> » puis le texte, la plus récente en premier dans l'affichage.
  const updates = match[2]
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [heading, ...body] = block.split('\n');
      const [at, ...label] = heading.trim().split(/\s+/);
      if (Number.isNaN(Date.parse(at)))
        throw new Error(`incidents/${slug}.md : « ## ${heading} » doit commencer par une date ISO`);
      return { at, label: label.join(' '), text: body.join('\n').trim() };
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return {
    slug,
    title: meta.title,
    impact,
    components: (meta.components ?? '').split(',').map((c) => c.trim()).filter(Boolean),
    started: meta.started,
    resolved: meta.resolved || undefined,
    updates,
  };
}

/** Incidents et maintenances du dossier `incidents/` (les fichiers commençant par `_` sont ignorés). */
export async function getIncidents(): Promise<Incident[]> {
  'use cache';
  cacheLife('max');
  const files = (await readdir(INCIDENTS_DIR)).filter(
    (f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md',
  );
  const incidents = await Promise.all(
    files.map(async (f) =>
      parseIncident(f.replace(/\.md$/, ''), await readFile(path.join(INCIDENTS_DIR, f), 'utf8')),
    ),
  );
  return incidents.sort((a, b) => Date.parse(b.started) - Date.parse(a.started));
}
