# LoL Duo Challenge

Dashboard für eine League-of-Legends-Duo-Challenge unter Freunden. Das Express-Backend (`server.js`) lädt Ränge und Ranked-Solo/Duo-Spiele über die Riot Games API, erkennt gemeinsame Duo-Spiele und Solo-Spiele ohne Partner und liefert die Ergebnisse an das React-Frontend (`src/`). In Produktion liefert derselbe Express-Server auch das gebaute Frontend aus.

## Ordnerstruktur

```
Claude-lol-website/
├── server.js                  Express-Backend: Riot API, Auswertung, /api/duos, /api/refresh
├── src/
│   ├── DuoChallengeDashboard.jsx   Dashboard-Komponente
│   ├── main.jsx               React-Einstieg
│   └── index.css              Tailwind-Einbindung
├── index.html                 Vite-HTML-Vorlage
├── vite.config.mjs            Vite inkl. Proxy /api -> localhost:3001
├── tailwind.config.js
├── postcss.config.js
├── render.yaml                Blueprint für Render.com
├── package.json
├── package-lock.json
├── .env.example               Vorlage für .env
├── .gitignore
│
│   (werden erzeugt, nicht im Git)
├── .env                       eigener API-Key
├── node_modules/
├── dist/                      gebautes Frontend (npm run build)
├── cache.json                 PUUIDs
├── matches_db.json            bereits geladene Matches
└── results.json               berechnete Ergebnisse
```

## Lokal starten

Voraussetzung: Node.js 20 oder neuer (`node -v`).

```bash
git clone https://github.com/htc7rwk7st-star/Claude-lol-website.git
cd Claude-lol-website
npm install
cp .env.example .env          # Windows: copy .env.example .env
```

In `.env` den Key von https://developer.riotgames.com eintragen (`RIOT_API_KEY=RGAPI-...`). Die Riot IDs der Duos stehen oben in `server.js` in der Liste `DUOS`.

```bash
npm run dev
```

- Dashboard: http://localhost:5173
- API: http://localhost:3001/api/duos

Beim ersten Start ist noch nichts geladen: auf „Stats aktualisieren“ klicken. Der erste Abruf dauert mit einem Development-Key einige Minuten (100 Requests pro 2 Minuten), danach sind die Matches gecacht.

Produktionsmodus lokal testen:

```bash
npm run build
npm start                     # alles unter http://localhost:3001
```

## Online stellen mit Render.com (kostenlos)

1. **Riot-Key klären.** Ein Development-Key läuft nach 24 Stunden ab. Für eine dauerhaft erreichbare Seite im Developer Portal unter „Register Product“ einen **Personal API Key** beantragen. Die Freigabe dauert meist einige Tage.
2. Auf https://render.com mit dem GitHub-Konto anmelden.
3. **New → Blueprint** wählen, das Repository `Claude-lol-website` auswählen. Render liest `render.yaml` und legt den Web-Service an.
4. Wenn Render nach `RIOT_API_KEY` fragt, den Key eintragen. `CHALLENGE_START_TIMESTAMP` und `CHALLENGE_END_TIMESTAMP` bei Bedarf in `render.yaml` oder im Dashboard unter **Environment** anpassen.
5. **Apply** klicken. Nach dem Build ist die Seite unter `https://lol-duo-challenge.onrender.com` (oder ähnlich) erreichbar. Diesen Link an die Freunde schicken.
6. Neuer Code: einfach `git push`. Render baut automatisch neu.

Einen neuen Riot-Key trägst du unter **Environment → RIOT_API_KEY** ein, Render startet den Dienst danach neu.

Einschränkungen des Free-Plans:

- Der Dienst schläft nach 15 Minuten ohne Besucher ein. Der erste Aufruf danach dauert etwa eine Minute.
- Das Dateisystem ist nicht dauerhaft. Nach dem Einschlafen, Neustart oder Deploy sind `cache.json` und `matches_db.json` weg. Wegen `REFRESH_ON_START=true` lädt der Server dann automatisch alles neu, das dauert je nach Anzahl der Matches einige Minuten.

Wer das vermeiden will, braucht dauerhaften Speicher: bei Render den Starter-Plan mit Disk (`DATA_DIR` auf den Mount-Pfad setzen) oder Railway (siehe unten).

## Alternative: Railway (mit dauerhaftem Speicher)

Railway hat keinen dauerhaft kostenlosen Plan: nach dem Testguthaben kostet der Hobby-Plan etwa 5 US-Dollar im Monat. Dafür bleiben die Daten mit einem Volume erhalten.

1. Auf https://railway.com mit GitHub anmelden, **New Project → Deploy from GitHub repo** und das Repository wählen.
2. Unter **Settings**: Build Command `npm ci --include=dev && npm run build`, Start Command `npm start`.
3. Unter **Variables**: `RIOT_API_KEY`, `CHALLENGE_START_TIMESTAMP`, `CHALLENGE_END_TIMESTAMP` und `DATA_DIR=/data` setzen.
4. Rechtsklick auf den Service → **Attach Volume**, Mount-Pfad `/data`.
5. Unter **Settings → Networking → Generate Domain** eine öffentliche Adresse erzeugen.

## Konfiguration (`.env`)

| Variable | Bedeutung |
| --- | --- |
| `RIOT_API_KEY` | Pflicht. Riot API Key |
| `CHALLENGE_START_TIMESTAMP` | Start in Unix-Sekunden, z. B. `1790805600` = 01.10.2026 00:00 MESZ |
| `CHALLENGE_END_TIMESTAMP` | Optional. Ende in Unix-Sekunden |
| `PORT` | Port des Servers, Standard `3001` |
| `REFRESH_ON_START` | `true` = beim Start automatisch aktualisieren |
| `REFRESH_TOKEN` | Optional. Schützt `POST /api/refresh`, dann funktioniert der Button nur mit Header `X-Refresh-Token` |
| `DATA_DIR` | Ordner für die JSON-Dateien |
| `ALLOWED_ORIGIN` | CORS-Origin, nur nötig wenn Frontend und Backend auf verschiedenen Domains laufen |
| `VITE_API_URL` | Nur beim Build: Adresse des Backends, falls das Frontend separat gehostet wird |

Timestamp berechnen: `node -e 'console.log(Date.parse("2026-10-01T00:00:00+02:00")/1000)'`

Diese Seite ist kein offizielles Produkt von Riot Games und wird von Riot Games weder unterstützt noch befürwortet.
