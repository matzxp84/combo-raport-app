# combo-raport-app

Interaktywna aplikacja raportowa do wizualizacji miesięcznych danych sprzedażowych i wolumenowych. Dane są ładowane dynamicznie z plików JSON według wybranej listy i miesiąca.

## Features

- **Dynamiczne ładowanie danych** – dane tabel pobierane są z plików JSON (`/public/data/T{n}/T{n}L{listId}.json`) per tabela i lista; brak blokowania całego UI podczas ładowania
- **Wybór listy i miesiąca** – selektor główny z mapowaniem nazwa→ID listy (`L1/L2/L3`), selektor miesiąca (01–12)
- **Wielosekciowy raport** – sekcje T1, T2, T5 renderowane osobno z niezależnymi stanami ładowania; każda sekcja oznaczona atrybutem `data-table-id` dla automatyzacji
- **TanStack Table** – headless table z dynamicznie generowanymi kolumnami na podstawie danych JSON
- **Dark mode** – przełącznik z detekcją preferencji systemowych (`prefers-color-scheme`), persystowany przez `ThemeProvider`
- **Podświetlanie komórek** – wsparcie dla `highlight` i `highlightBg` na poziomie danych JSON, renderowane jako wyróżnione komórki w tabeli
- **Stabilne ID elementów DOM** – komórki, wiersze i sekcje mają deterministyczne atrybuty `data-*` (np. `data-cell-id="TYLM"`) generowane z etykiet rocznych i miesięcznych, co umożliwia integrację z systemami zewnętrznymi
- **Checkboxy filtrowania wierszy** – możliwość ukrywania wybranych wierszy raportu bezpośrednio w UI

## Specyfikacja rozwiązań

### Struktura danych

Każdy plik JSON to tablica wierszy `ReportRow[]`:
```json
[{ "id": "2026", "label": "2026", "cells": [{ "value": "88 045", "highlight": true }] }]
```
Nazwa pliku koduje tabelę i listę: `T1L12830.json` → tabela T1, lista L1, lokalizacja 2830.

### Mapowanie ID komórek (T1)

Etykiety roczne są mapowane na czytelne skróty:
- `2026` → `TY`, `2025` → `LY`, `2024` → `AY`
- `2026 vs 2025` → `VS1`, `2025 vs 2024` → `VS2`

Miesięczne ID komórek dla bieżącego roku (TY) mają aliasy: `TY+02 → TYLM`, `TY+03 → TYTM`, `TY+04 → TYNM`.

### Stack technologiczny

| Warstwa | Technologia |
|---|---|
| UI | React 19, Tailwind CSS 4, shadcn/ui, Base UI |
| Tabele | TanStack Table v8 |
| Ikony | Phosphor Icons, Lucide React |
| Build | Vite 7, TypeScript 5.9 |
| Fonty | JetBrains Mono Variable, Noto Sans Variable |

## Report list IDs

The demo report uses predefined lists of locations. Each list has a stable `list_id`:

- **L1** – `Rafał Lubak`
- **L2** – `Rafał Wieczorek`
- **L3** – `Andrzej Chmielewski`

In the UI, the main list selector shows both the name and the `list_id` in parentheses (e.g. `Rafał Lubak (L1)`), and the code maps from the display name to the internal `list_id` for integration with external systems.

## Report table IDs

Each report section has a stable `table_id`:

| table_id | Section | Context (title suffix) |
|----------|---------|-------------------------|
| **T1** | 1. Informacje o wolumenie miesięcznym | `name_alias` |
| **T2** | 2. Kluczowe wskaźniki miesięczne | `name_alias` |
| **T5** | 5. Sprzedaż od początku roku | `list_name` |

Sections are marked with `data-table-id` (e.g. `data-table-id="T1"`) for automation or analytics.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
