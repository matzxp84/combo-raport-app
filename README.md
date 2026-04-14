# combo-raport-app

Interaktywna aplikacja raportowa do wizualizacji miesięcznych danych sprzedażowych i wolumenowych. Dane są ładowane dynamicznie z plików JSON według wybranej listy i miesiąca.

---

## Docker – szybki start

### Tryb developerski (hot-reload)

```bash
docker compose --profile dev up
```

Aplikacja dostępna pod: **http://localhost:5173**

Pliki z hosta są montowane do kontenera — każda zmiana w `src/` lub `public/data/` odświeża przeglądarkę automatycznie.

### Zatrzymanie

```bash
docker compose --profile dev down
```

### Build produkcyjny (nginx)

```bash
docker compose --profile prod up --build
```

Aplikacja dostępna pod: **http://localhost:4173**

### Rebuild po zmianie zależności (package.json)

```bash
docker compose --profile dev build --no-cache
docker compose --profile dev up
```

### Podgląd logów kontenera

```bash
docker logs combo_dev -f
```

### Wejście do shella kontenera

```bash
docker exec -it combo_dev sh
```

---

## Komendy pnpm (lokalnie, bez Dockera)

```bash
pnpm dev          # serwer deweloperski
pnpm build        # kompilacja TypeScript + Vite build
pnpm preview      # podgląd produkcyjnego builda
pnpm lint         # ESLint
pnpm format       # Prettier (nadpisuje pliki)
pnpm typecheck    # tsc --noEmit (samo sprawdzenie typów, bez buildu)
```

---

## Struktura projektu

```
combo-raport-app/
├── src/
│   ├── App.tsx                     # główny komponent, logika wyboru listy/miesiąca
│   ├── main.tsx                    # punkt wejścia React
│   ├── index.css                   # globalne style + zmienne Tailwind
│   ├── components/
│   │   ├── theme-provider.tsx      # dark/light mode, persystencja
│   │   └── ui/                     # komponenty shadcn/ui (button, table, checkbox…)
│   └── lib/
│       └── utils.ts                # cn() helper (clsx + tailwind-merge)
├── public/
│   └── data/
│       ├── T1/                     # dane tabeli T1 per lista
│       ├── T2/                     # dane tabeli T2 per lista
│       └── T5/                     # dane tabeli T5 per lista
├── docker/
│   └── nginx.conf                  # konfiguracja nginx dla trybu prod
├── Dockerfile                      # multi-stage: base → deps → dev / build → prod
├── docker-compose.yml              # profile: dev (5173) i prod (4173)
├── .dockerignore
├── vite.config.ts
├── tsconfig.json
├── components.json                 # konfiguracja shadcn
└── package.json
```

---

## Dodawanie komponentów shadcn

```bash
npx shadcn@latest add button
```

Komponenty trafiają do `src/components/ui/`. Import:

```tsx
import { Button } from "@/components/ui/button"
```

---

## Dane raportowe

### Struktura pliku JSON

Każdy plik to tablica `ReportRow[]`:

```json
[{ "id": "2026", "label": "2026", "cells": [{ "value": "88 045", "highlight": true }] }]
```

Ścieżka pliku: `public/data/T{n}/T{n}L{listId}.json`
Przykład: `public/data/T1/T1L12830.json` → tabela T1, lista L1, lokalizacja 2830.

### Listy (list_id)

| Wyświetlana nazwa | list_id |
|---|---|
| Rafał Lubak | L1 |
| Rafał Wieczorek | L2 |
| Andrzej Chmielewski | L3 |

### Sekcje raportu (table_id)

| table_id | Sekcja |
|---|---|
| T1 | Informacje o wolumenie miesięcznym |
| T2 | Kluczowe wskaźniki miesięczne |
| T5 | Sprzedaż od początku roku |

Każda sekcja w DOM ma atrybut `data-table-id="T1"` — przydatne przy automatyzacji.

### Mapowanie ID komórek (T1)

| Etykieta | Alias |
|---|---|
| 2026 | TY |
| 2025 | LY |
| 2024 | AY |
| 2026 vs 2025 | VS1 |
| 2025 vs 2024 | VS2 |

Aliasy miesięczne dla bieżącego roku: `TY+02 → TYLM`, `TY+03 → TYTM`, `TY+04 → TYNM`.

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| UI | React 19, Tailwind CSS 4, shadcn/ui, Base UI |
| Tabele | TanStack Table v8 |
| Ikony | Phosphor Icons, Lucide React |
| Build | Vite 7, TypeScript 5.9 |
| Fonty | JetBrains Mono Variable, Noto Sans Variable |
| Kontener | Docker (multi-stage), nginx 1.27 |

---

## Wskazówki

**Zmiana danych bez restartu kontenera** — edytuj pliki w `public/data/` bezpośrednio. Vite wykrywa zmiany JSON i przeładuje stronę automatycznie (skonfigurowane w `vite.config.ts` przez `vite-plugin-live-reload`).

**Dodanie nowej listy** — utwórz pliki JSON dla każdej tabeli (`T1`, `T2`, `T5`) z nowym `listId`, a następnie zarejestruj listę w selektorze w `App.tsx`.

**Bundle analysis** — uruchom `pnpm build`, a potem otwórz `stats.html` w katalogu głównym. Pokaże rozkład rozmiarów modułów.

**Sprawdzenie typów bez buildu** — użyj `pnpm typecheck`. Szybsze niż pełny build, nie generuje plików wyjściowych.

**Logi live w Docker Desktop** — w zakładce Containers kliknij `combo_dev` → zakładka Logs. Alternatywnie `docker logs combo_dev -f` w terminalu.

**Zmiana portu dev** — edytuj `docker-compose.yml` (linia `"5173:5173"`) i `vite.config.ts` (dodaj `server: { port: XXXX }`), następnie zrób rebuild.
