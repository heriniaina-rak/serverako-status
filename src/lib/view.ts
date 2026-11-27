import { cacheLife } from 'next/cache';
import {
  COMPONENTS,
  getIncidents,
  getStatusData,
  type Impact,
  type Incident,
} from './status';

export const DAYS_SHOWN = 90;
/** Sans mesure depuis 20 min, on ne prétend plus rien : les sondes sont arrêtées ou en retard. */
const STALE_AFTER_MS = 20 * 60_000;

export type Level = 'up' | 'maintenance' | 'degraded' | 'down' | 'unknown';
export type DayBar = { date: string; ratio: number | null; incidents: string[] };
export type ComponentView = {
  id: string;
  name: string;
  description: string;
  level: Level;
  since?: string;
  uptime: number | null;
  bars: DayBar[];
};
export type View = {
  generatedAt: string;
  updatedAt?: string;
  stale: boolean;
  overall: Level;
  components: ComponentView[];
  active: Incident[];
  upcoming: Incident[];
  past: Incident[];
};

const RANK: Record<Level, number> = { unknown: 0, up: 1, maintenance: 2, degraded: 3, down: 4 };
const worst = (levels: Level[]): Level =>
  levels.reduce<Level>((a, b) => (RANK[b] > RANK[a] ? b : a), 'up');
const IMPACT_LEVEL: Record<Impact, Level> = { major: 'down', minor: 'degraded', maintenance: 'maintenance' };

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Tout ce que la page affiche, calculé une fois par minute au plus. */
export async function getView(): Promise<View> {
  'use cache';
  cacheLife('minutes');
  const [data, incidents] = await Promise.all([getStatusData(), getIncidents()]);
  const now = Date.now();
  const stale = !data?.updatedAt || now - Date.parse(data.updatedAt) > STALE_AFTER_MS;

  const active = incidents.filter((i) => !i.resolved && Date.parse(i.started) <= now);
  const upcoming = incidents
    .filter((i) => !i.resolved && Date.parse(i.started) > now)
    .reverse();
  const past = incidents.filter(
    (i) => i.resolved && now - Date.parse(i.resolved) < 30 * 86400_000,
  );

  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => isoDay(now - (DAYS_SHOWN - 1 - i) * 86400_000));

  const components = COMPONENTS.map((c): ComponentView => {
    const measured = data?.components[c.id];
    const probeLevel: Level = stale || !measured ? 'unknown' : measured.state === 'up' ? 'up' : 'down';
    const incidentLevels = active.filter((i) => i.components.includes(c.id)).map((i) => IMPACT_LEVEL[i.impact]);
    const level = probeLevel === 'unknown' && incidentLevels.length === 0 ? 'unknown' : worst([probeLevel, ...incidentLevels]);

    let up = 0;
    let total = 0;
    const bars = days.map((date) => {
      const counts = data?.days[date]?.[c.id];
      if (counts) {
        up += counts[0];
        total += counts[1];
      }
      return {
        date,
        ratio: counts && counts[1] > 0 ? counts[0] / counts[1] : null,
        incidents: incidents
          .filter(
            (i) =>
              i.components.includes(c.id) &&
              i.impact !== 'maintenance' &&
              isoDay(Date.parse(i.started)) <= date &&
              (!i.resolved || isoDay(Date.parse(i.resolved)) >= date),
          )
          .map((i) => i.title),
      };
    });

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      level,
      since: measured?.since,
      uptime: total > 0 ? up / total : null,
      bars,
    };
  });

  const levels = components.map((c) => c.level);
  const overall = levels.every((l) => l === 'unknown') ? 'unknown' : worst(levels);

  return {
    generatedAt: new Date(now).toISOString(),
    updatedAt: data?.updatedAt,
    stale,
    overall,
    components,
    active,
    upcoming,
    past,
  };
}
