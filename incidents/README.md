# Incidents et maintenances

Un fichier Markdown par incident ou maintenance, publié par un simple `git push` sur `main` (Vercel redéploie). Les fichiers dont le nom commence par `_` sont ignorés (voir `_exemple.md`).

```markdown
---
title: Applications injoignables
impact: major
components: apps, api
started: 2026-11-27T10:00:00+03:00
resolved: 2026-11-27T10:12:00+03:00
---

## 2026-11-27T10:12:00+03:00 Résolu
Les applications répondent de nouveau.

## 2026-11-27T10:03:00+03:00 Identifié
La machine a redémarré, les services repartent.
```

- `impact` : `major` (panne), `minor` (perturbation) ou `maintenance`.
- `components` : identifiants de `status.config.json` (`apps`, `api`, `dashboard`, `site`), séparés par des virgules.
- `started` / `resolved` : dates ISO avec fuseau. Sans `resolved`, l'incident est **en cours** ; une maintenance dont `started` est dans le futur est affichée comme **prévue**.
- Chaque mise à jour est un titre `## <date ISO> <libellé>` suivi du texte ; la plus récente est affichée en premier.
- Les incidents résolus restent affichés 30 jours, et marquent les barres de disponibilité des jours concernés.

Un fichier mal formé fait échouer le build : l'erreur nomme le fichier et le champ.
