# serverako-status

Page de statut publique de Serverako (status.serverako.com, BACKLOG 9.8), hébergée sur Vercel, **hors de la machine Serverako** : elle reste lisible quand la plateforme est en panne.

## Fonctionnement

- **Sondes** : `.github/workflows/probe.yml` lance `scripts/probe.mjs` toutes les 5 minutes sur les URLs de `status.config.json`. Un composant n'est en panne qu'après deux essais ratés à 5 s d'écart.
- **Historique** : `status.json` sur la branche `data` (état courant, mesures des dernières 24 h, cumul par jour sur 90 jours), réécrite en un seul commit à chaque passage. Vercel ne déploie pas cette branche (`vercel.json`).
- **Page** : `src/app/page.tsx` relit `status.json` au plus toutes les minutes (`cacheLife('minutes')`, URL `STATUS_DATA_URL`, par défaut le fichier brut de la branche `data` sur GitHub). Sans mesure depuis 20 minutes, elle annonce que les sondes sont en retard au lieu d'afficher un état périmé.
- **Incidents et maintenances** : un fichier Markdown par incident dans `incidents/` (voir `incidents/README.md`), publié par `git push`.

## Composants sondés

| id | URL | Attendu |
| --- | --- | --- |
| `apps` | `https://status-probe.serverako.com/` (nom inexistant) | toute réponse < 500 : Cloudflare, tunnel et Traefik répondent (502/530 = tunnel coupé) |
| `api` | `https://api.serverako.com/health` | 200 : l'API joint Postgres et Redis |
| `dashboard` | `https://app.serverako.com/` | 200 |
| `site` | `https://serverako.com/` | 200 |

## Développement

```bash
pnpm install
node scripts/probe.mjs status.config.json /tmp/status.json   # une mesure locale
STATUS_DATA_FILE=/tmp/status.json pnpm dev
```

## Mise en place

1. Repo GitHub **public** (la page lit `status.json` sur raw.githubusercontent.com) avec les branches `main` et `data`.
2. Actions → workflow `probe` → *Run workflow* pour la première mesure. GitHub désactive les workflows planifiés d'un repo public après 60 jours sans activité : le réactiver depuis l'onglet Actions si la page annonce des sondes en retard.
3. Vercel : importer le repo (preset Next.js, aucune variable obligatoire), domaine `status.serverako.com`, puis chez Cloudflare un CNAME `status` → `cname.vercel-dns.com` **non proxifié** (il prime sur le joker `*.serverako.com` du tunnel).
