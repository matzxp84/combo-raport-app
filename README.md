# React + TypeScript + Vite + shadcn/ui + tailwind

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

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
