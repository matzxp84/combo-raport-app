# combo-raport-app

Interaktywna aplikacja raportowa do wizualizacji danych sprzedażowych i wolumenowych z systemu GoPos. Dane pobierane przez API, raporty wysyłane automatycznie emailem.

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
