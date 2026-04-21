# combo-raport-app

Interaktywna aplikacja raportowa do wizualizacji danych sprzedażowych i wolumenowych z systemu GoPos. Dane pobierane przez API, raporty wysyłane automatycznie emailem.

---

## Schemat architektury

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRZEGLĄDARKA  http://localhost:5173 (dev) / :4173 (prod) / :87    │
│                                                                      │
│  index.html → src/main.tsx → src/App.tsx                           │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ LoginPage    │  │ AdminPanel   │  │ Tabele + Wykresy          │  │
│  │ (JWT login)  │  │ users / logs │  │ T1 volume / T2 KPI / T5  │  │
│  └──────┬───────┘  │ email config │  │ YTD (Recharts)           │  │
│         │          └──────────────┘  └──────────┬───────────────┘  │
│         │                                        │                  │
│    AuthContext (JWT w localStorage)    gopos-client.ts             │
└─────────┼──────────────────────────────────────┼────────────────────┘
          │  POST /api/auth/login                 │  GET /api/gopos/t1,t2,t5
          ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND  src/server/plugin.ts  (Vite middleware dev / Node prod)  │
│                                                                      │
│  /api/auth/*   ──►  auth.ts      JWT + scrypt, użytkownicy, logi  │
│  /api/admin/*  ──►  auth.ts      CRUD users, audit log             │
│  /api/admin/email/* ► email.ts   SMTP, harmonogram, szablony       │
│  /api/gopos/*  ──►  gopos-api.ts fetch danych → gopos-mapper.ts   │
│                                                                      │
│  Dane persystowane w JSON (Docker volume combo_data):              │
│  data/auth.json  (users, JWT secret, audit log)                    │
│  data/email.json (SMTP config, schedule, recipients)               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  OAuth2 token (gopos-auth.ts)
                               │  cache: .cache/token-cache/
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GOPOS API  https://app.gopos.io/api/v3/reports/*                  │
│                                                                      │
│  /orders       → liczba transakcji, net total, avg bill            │
│  /order_items  → pozycje (pizze, napoje, startery, dodatki)        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  DOCKER  docker-compose.yml                                         │
│                                                                      │
│  profile: dev     combo_dev    :5173  Vite HMR, src/ z volume      │
│  profile: prod    combo_prod   :4173  Node + dist/ (po build)      │
│  profile: prod87  combo_prod87 :87    Mikrus VPS (toadres.pl)      │
│                                                                      │
│  Sieć: combo_net (izolowana od spzw_*)                             │
│  Wolumeny: combo_data / combo_data_87 (auth.json, email.json)      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SKRYPTY  scripts/                                                  │
│                                                                      │
│  regenerate-data.ts  → fetch GoPos dla wszystkich org              │
│                         → public/data/T1/*.json T2/*.json T5/*.json │
│  deploy-prod.sh      → SSH na Mikrus: git pull + docker build      │
│  backup-gdrive.sh    → backup wolumenów na Google Drive            │
└─────────────────────────────────────────────────────────────────────┘
```

### Przepływ danych (request)

```
App.tsx (wybór lokalizacji)
  └─► src/lib/api/gopos-client.ts
        └─► GET /api/gopos/t1/current?org=2830  (Bearer JWT)
              └─► plugin.ts: requireAuth() → JWT verify
                    └─► gopos-api.ts: fetchOrders() + fetchOrderItems()
                          └─► gopos-auth.ts: OAuth2 token (cache 55 min)
                                └─► app.gopos.io/api/v3/reports/*
                          └─► gopos-mapper.ts: agregacja kategorii
                    └─► Response JSON → wykresy + tabela
```

### Struktura plików źródłowych

```
src/
├── main.tsx                    # bootstrap React + providers
├── App.tsx                     # główny layout, sidebar, tabele
├── components/
│   ├── LoginPage.tsx           # formularz logowania
│   ├── AdminPanel.tsx          # panel admina
│   ├── EmailReportSection.tsx  # config SMTP + harmonogram
│   ├── TableConsole.tsx        # tabela z sortowaniem/paginacją
│   ├── charts/
│   │   ├── T1VolumeChart.tsx   # wykres przychodu miesięcznego
│   │   ├── T2KpiChart.tsx      # KPI (avg paragon, klienci...)
│   │   └── T5YtdChart.tsx      # breakdown kategorii YTD
│   └── ui/                     # shadcn/ui (button, input...)
├── contexts/
│   ├── AuthContext.tsx         # JWT token, authFetch wrapper
│   └── LogContext.tsx          # logowanie requestów w UI
├── config/
│   └── locations.json          # 30+ restauracji (org_id, nazwa, lista)
├── lib/
│   └── api/gopos-client.ts     # typowane funkcje fetch T1/T2/T5
└── server/
    ├── plugin.ts               # router API (Vite middleware + Node)
    ├── auth.ts                 # JWT, scrypt, użytkownicy, audit log
    ├── email.ts                # SMTP, emailmd szablony, harmonogram
    ├── gopos-api.ts            # fetch z GoPos API v3
    ├── gopos-auth.ts           # OAuth2 token cache
    └── gopos-mapper.ts         # kategoryzacja: pizze/napoje/startery
```

---

## Docker — szybki start

```bash
# Dev (hot-reload)
docker compose --profile dev up
# http://localhost:5173

# Produkcja (lokalnie)
docker compose --profile prod up --build
# http://localhost:4173
```

### Zatrzymanie

```bash
docker compose --profile dev down
```

### Rebuild po zmianie zależności (package.json)

```bash
docker compose --profile dev build --no-cache
docker compose --profile dev up
```

### Podgląd logów / shell

```bash
docker logs combo_dev -f
docker exec -it combo_dev sh
```

---

## Deploy na produkcję (Mikrus)

### Setup (jednorazowo)

```bash
# 1. Skonfiguruj połączenie z serwerem
cp .deploy.env.example .deploy.env
# Edytuj .deploy.env — ustaw host, port SSH, ścieżkę

# 2. Wypchnij kod na GitHub
git push origin main
```

### Deploy

```bash
# Pełny deploy (kod + dane: użytkownicy, config emaila, secrets)
./scripts/deploy-prod.sh

# Tylko kod (bez nadpisywania danych na serwerze)
./scripts/deploy-prod.sh --code-only

# Tylko dane (sync użytkowników/emaila z dev na prod)
./scripts/deploy-prod.sh --data-only
```

Skrypt automatycznie:
1. Eksportuje `auth.json` i `email.json` z lokalnego wolumenu Docker (`combo_data`)
2. Kopiuje je na serwer przez SCP → importuje do wolumenu `combo_data_87`
3. Kopiuje `.env` (secrets GoPos) na serwer
4. Robi `git pull` + `docker compose --profile prod87 up -d --build`
5. Sprawdza healthcheck kontenera

### Profile Docker

| Profil | Kontener | Port | Wolumin danych | Opis |
|--------|----------|------|----------------|------|
| `dev` | `combo_dev` | `5173` | `combo_data` | Vite hot-reload, pliki montowane z hosta |
| `prod` | `combo_prod` | `4173` | `combo_data` | Node server, zbudowany dist/ |
| `prod87` | `combo_prod87` | `87` | `combo_data_87` | Produkcja na Mikrusie |

### Secrets

| Secret | Gdzie | Ochrona |
|--------|-------|---------|
| GoPos API keys | `.env` | gitignore + dockerignore |
| JWT secret | `auth.json` (Docker volume) | nie w repo |
| Hasła użytkowników | `auth.json` (scrypt hash) | hashowane, nie w repo |
| Hasło SMTP | `email.json` (Docker volume) | nie w repo |

> `.env` i `.deploy.env` NIGDY nie trafiają do gita.

---

## Backup

Automatyczny backup wolumenów danych na Google Drive:

```bash
# Manualny
./scripts/backup-gdrive.sh

# Cron (codziennie o 03:00)
0 3 * * * /path/to/scripts/backup-gdrive.sh >> /var/log/combo-backup.log 2>&1
```

---

## Vite — rola w projekcie

[Vite](vite.config.ts) to dev server i bundler frontendu. W tym projekcie pełni więcej funkcji niż samo serwowanie plików:

| Plugin | Plik | Co robi |
|--------|------|---------|
| `goposApiPlugin` | [src/server/plugin.ts](src/server/plugin.ts) | własne middleware API (GoPos, auth, email) zintegrowane z Vite dev serverem |
| `liveReload` + `watchAndRun` | [vite.config.ts](vite.config.ts#L32) | full-reload przeglądarki gdy zmienią się pliki w `public/data/` |
| `checker` | [vite.config.ts](vite.config.ts#L22) | TypeScript + ESLint sprawdzane na bieżąco, błędy w overlay przeglądarki |
| `tailwindcss` | — | kompilacja CSS v4 |
| `svgr` | — | importowanie SVG jako komponentów React |
| `tsconfigPaths` | — | aliasy `@/...` → `src/` |
| `visualizer` | [stats.html](stats.html) | analiza bundle po `pnpm build` |

### Tryby pracy

| Komenda | Gdzie | Port | Vite działa? |
|---------|-------|------|--------------|
| `pnpm dev` | host bezpośrednio | 5173 | tak — dev server z HMR |
| `docker compose --profile dev up` | kontener | 5173 | tak — ten sam Vite, źródła z volume |
| `docker compose --profile prod up` | kontener | 4173 | nie — tylko zbudowany `dist/` |

> **Uwaga:** nie uruchamiaj `pnpm dev` na hoście i `docker compose --profile dev` jednocześnie — oba zajmują port 5173.

### Kolizja z Dockerem?

Nie ma kolizji. Sieć [`combo_net`](docker-compose.yml#L88) jest izolowana od kontenerów `spzw_*`. Profile (`dev`, `prod`, `prod87`) używają różnych portów i nigdy nie startują razem.

---

## Komendy pnpm (lokalnie, bez Dockera)

```bash
pnpm dev          # serwer deweloperski
pnpm build        # kompilacja TypeScript + Vite build
pnpm preview      # podgląd produkcyjnego builda
pnpm lint         # ESLint
pnpm format       # Prettier (nadpisuje pliki)
pnpm typecheck    # tsc --noEmit
```

---

## Struktura projektu

```
combo-raport-app/
├── src/
│   ├── App.tsx                     # główny komponent aplikacji
│   ├── main.tsx                    # punkt wejścia React
│   ├── components/                 # UI: tabele, wykresy, dark mode
│   ├── server/                     # API: auth, GoPos, email, raporty
│   ├── config/                     # lokalizacje, listy
│   └── lib/                        # cn() helper
├── data/                           # runtime: auth.json, email.json (gitignored)
├── scripts/
│   ├── deploy-prod.sh              # deploy na serwer produkcyjny
│   └── backup-gdrive.sh            # backup danych na Google Drive
├── wiki/                           # dokumentacja projektu
├── Dockerfile                      # multi-stage: base → deps → dev / build → prod
├── docker-compose.yml              # profile: dev, prod, prod87
└── .env                            # secrets GoPos (gitignored)
```

---

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, TanStack Table v8 |
| Backend | Node.js 22, TypeScript 5.9, Vite 7 |
| Auth | JWT + scrypt, panel admina |
| Email | nodemailer + email.md, harmonogramy miesięczne/tygodniowe |
| Dane | GoPos API (OAuth2) |
| Ikony | Phosphor Icons, Lucide React |
| Fonty | JetBrains Mono Variable, Noto Sans Variable |
| Kontener | Docker multi-stage, Node 22 Alpine |

---

## Dokumentacja

| Strona | Opis |
|--------|------|
| [Docker](wiki/Docker.md) | Profile, komendy, wolumeny, sieć |
| [Deploy](wiki/Deploy.md) | Deploy na produkcję, sync danych, secrets |
| [Backup](wiki/Backup.md) | Backup na GDrive, rclone, disaster recovery |
| [Struktura](wiki/Struktura-projektu.md) | Drzewo katalogów, stack, skrypty |
| [Dane raportowe](wiki/Dane-raportowe.md) | Format JSON, listy, tabele |
| [Komponenty](wiki/Komponenty.md) | Architektura UI, dark mode |

---

## Wskazówki

- **Zmiana danych bez restartu** — edytuj pliki w `public/data/`, Vite przeładuje automatycznie
- **Bundle analysis** — `pnpm build` → otwórz `stats.html`
- **Dodanie komponentu shadcn** — `npx shadcn@latest add button`
- **Seed users** — przy pustym `auth.json` tworzone automatycznie: `matfl@tuta.com` / `pułtusk` (admin), `daniel.piekarski@t-pizza.pl` / `daniel` (user) — **zmień hasła po pierwszym deployu**
