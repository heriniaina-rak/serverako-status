import { DAYS_SHOWN, getView, type DayBar, type Level } from '@/lib/view';
import type { Incident } from '@/lib/status';

const TZ = 'Indian/Antananarivo';
const dateTime = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const fmt = (iso: string) => dateTime.format(new Date(iso));
const percent = (ratio: number) =>
  `${(Math.floor(ratio * 10000) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

const LEVEL: Record<Level, { label: string; text: string; bg: string }> = {
  up: { label: 'Opérationnel', text: 'text-ok', bg: 'bg-ok' },
  maintenance: { label: 'Maintenance', text: 'text-muted', bg: 'bg-muted' },
  degraded: { label: 'Perturbé', text: 'text-warn', bg: 'bg-warn' },
  down: { label: 'Panne', text: 'text-error', bg: 'bg-error' },
  unknown: { label: 'Pas de mesure', text: 'text-muted', bg: 'bg-neutral' },
};
const OVERALL: Record<Level, string> = {
  up: 'Tous les systèmes sont opérationnels',
  maintenance: 'Maintenance en cours',
  degraded: 'Fonctionnement perturbé',
  down: 'Panne en cours',
  unknown: 'Mesures indisponibles pour le moment',
};
const IMPACT = { major: 'Panne', minor: 'Perturbation', maintenance: 'Maintenance' } as const;

function LevelIcon({ level, className = 'size-5' }: { level: Level; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={`${className} shrink-0 ${LEVEL[level].text}`}>
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.18" />
      {level === 'up' ? (
        <path d="M5.5 10.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : level === 'maintenance' ? (
        <path d="M10 5v5l3 2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      ) : level === 'unknown' ? (
        <path d="M7.5 8a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5M10 14.6v.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M10 5.5v5.5M10 14.4v.1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

function barColor(bar: DayBar) {
  if (bar.ratio === null) return 'bg-neutral';
  if (bar.ratio < 0.95) return 'bg-error';
  if (bar.ratio < 0.995 || bar.incidents.length > 0) return 'bg-warn';
  return 'bg-ok';
}

function barLabel(bar: DayBar) {
  const day = dayFormat.format(new Date(`${bar.date}T00:00:00Z`));
  const measure = bar.ratio === null ? 'pas de mesure' : `disponibilité ${percent(bar.ratio)}`;
  return [`${day} : ${measure}`, ...bar.incidents].join('\n');
}

function IncidentCard({ incident, tone }: { incident: Incident; tone: 'active' | 'upcoming' | 'past' }) {
  const level: Level =
    tone === 'past' ? 'up' : incident.impact === 'major' ? 'down' : incident.impact === 'minor' ? 'degraded' : 'maintenance';
  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <LevelIcon level={level} className="mt-0.5 size-5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-heading">{incident.title}</h3>
          <p className="text-xs text-muted">
            {IMPACT[incident.impact]} · {tone === 'upcoming' ? 'prévue le ' : 'début '}
            {fmt(incident.started)}
            {incident.resolved && ` · fin ${fmt(incident.resolved)}`}
          </p>
        </div>
      </header>
      {incident.updates.length > 0 && (
        <ol className="mt-4 space-y-3 border-l border-border pl-4 sm:ml-8">
          {incident.updates.map((u) => (
            <li key={u.at}>
              <p className="text-xs text-muted">
                <span className="font-semibold text-heading">{u.label || 'Mise à jour'}</span> · {fmt(u.at)}
              </p>
              {u.text && <p className="mt-1 whitespace-pre-line">{u.text}</p>}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export default async function StatusPage() {
  const view = await getView();
  const overall = LEVEL[view.overall];

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <a href="https://serverako.com" className="shrink-0" aria-label="Serverako, retour au site">
          <picture>
            <source srcSet="/serverako-logo.svg" media="(prefers-color-scheme: light)" />
            <img src="/serverako-logo-white.svg" alt="Serverako" width={140} height={32} className="h-8 w-auto" />
          </picture>
        </a>
        <a
          href="https://app.serverako.com"
          className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-heading hover:bg-surface-hover"
        >
          Dashboard
        </a>
      </header>

      <main className="mt-10 flex-1 space-y-10">
        <section
          aria-live="polite"
          className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 sm:p-6"
        >
          <LevelIcon level={view.overall} className="size-9" />
          <div>
            <h1 className="text-xl font-semibold text-heading sm:text-2xl">{OVERALL[view.overall]}</h1>
            <p className={`mt-0.5 text-[13px] ${view.stale ? 'text-warn' : 'text-muted'}`}>
              {view.stale
                ? view.updatedAt
                  ? `Dernière mesure le ${fmt(view.updatedAt)} : les sondes sont en retard, l'état affiché peut être ancien.`
                  : 'Aucune mesure reçue pour le moment.'
                : `Dernière mesure le ${fmt(view.updatedAt!)} · sondes toutes les 5 minutes depuis l'extérieur`}
            </p>
          </div>
          <span className={`sr-only ${overall.text}`}>{overall.label}</span>
        </section>

        {view.active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-heading">Incidents en cours</h2>
            {view.active.map((i) => (
              <IncidentCard key={i.slug} incident={i} tone="active" />
            ))}
          </section>
        )}

        {view.upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-heading">Maintenances prévues</h2>
            {view.upcoming.map((i) => (
              <IncidentCard key={i.slug} incident={i} tone="upcoming" />
            ))}
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold text-heading">Composants</h2>
            <p className="text-xs text-muted">Disponibilité sur {DAYS_SHOWN} jours</p>
          </div>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {view.components.map((c) => (
              <li key={c.id} className="p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <LevelIcon level={c.level} />
                  <h3 className="text-base font-semibold text-heading">{c.name}</h3>
                  <span className={`ml-auto text-[13px] font-medium ${LEVEL[c.level].text}`}>
                    {LEVEL[c.level].label}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-muted sm:ml-8">{c.description}</p>
                <ol
                  className="mt-4 flex h-8 gap-[2px] sm:ml-8"
                  aria-label={`${c.name} : disponibilité jour par jour`}
                >
                  {c.bars.map((bar, i) => (
                    <li
                      key={bar.date}
                      title={barLabel(bar)}
                      aria-label={barLabel(bar)}
                      className={`min-w-0 flex-1 rounded-[2px] ${barColor(bar)} ${i < DAYS_SHOWN - 30 ? 'hidden sm:block' : ''} hover:opacity-70`}
                    />
                  ))}
                </ol>
                <div className="mt-2 flex justify-between text-xs text-muted sm:ml-8">
                  <span>
                    <span className="hidden sm:inline">Il y a {DAYS_SHOWN} jours</span>
                    <span className="sm:hidden">Il y a 30 jours</span>
                  </span>
                  <span className="font-mono">{c.uptime === null ? '—' : percent(c.uptime)}</span>
                  <span>Aujourd&apos;hui</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-heading">Incidents des 30 derniers jours</h2>
          {view.past.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-5 text-muted">
              Aucun incident signalé ces 30 derniers jours.
            </p>
          ) : (
            view.past.map((i) => <IncidentCard key={i.slug} incident={i} tone="past" />)
          )}
        </section>
      </main>

      <footer className="mt-12 flex flex-wrap justify-between gap-2 border-t border-border pt-5 text-xs text-muted">
        <span>Heures affichées à l&apos;heure de Madagascar (UTC+3).</span>
        <a href="https://serverako.com" className="hover:text-heading">
          serverako.com
        </a>
      </footer>
    </div>
  );
}
