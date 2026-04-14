import rawConfig from "./locations.json";

export type ListId = "L1" | "L2" | "L3";

export type LocationEntry = {
  list_id: ListId;
  list_name: string;
  organization_id: string;
  name: string;
  name_alias: string;
  company_id: string;
  slug: string;
};

const LIST_ID_TO_DISPLAY_NAME: Record<ListId, string> = {
  L1: "Rafał Lubak",
  L2: "Rafał Wieczorek",
  L3: "Andrzej Chmielewski",
};

export const LISTS: Array<{ id: ListId; name: string }> = (
  Object.entries(LIST_ID_TO_DISPLAY_NAME) as Array<[ListId, string]>
).map(([id, name]) => ({ id, name }));

export const LOCATIONS: LocationEntry[] = (
  rawConfig.locations as LocationEntry[]
).map((l) => ({ ...l }));

export type LocationOption = {
  nameAlias: string;
  organizationId: string;
};

export const LIST_NAME_TO_ALIASES: Record<string, LocationOption[]> = (() => {
  const map: Record<string, LocationOption[]> = {};
  for (const id of Object.keys(LIST_ID_TO_DISPLAY_NAME) as ListId[]) {
    map[LIST_ID_TO_DISPLAY_NAME[id]] = [];
  }
  for (const loc of LOCATIONS) {
    const displayName = LIST_ID_TO_DISPLAY_NAME[loc.list_id];
    if (!displayName) continue;
    map[displayName].push({
      nameAlias: loc.name_alias,
      organizationId: loc.organization_id,
    });
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.nameAlias.localeCompare(b.nameAlias));
  }
  return map;
})();

export const LIST_ID_BY_NAME: Record<string, ListId> = (() => {
  const map: Record<string, ListId> = {};
  for (const [id, name] of Object.entries(LIST_ID_TO_DISPLAY_NAME) as Array<
    [ListId, string]
  >) {
    map[name] = id;
  }
  return map;
})();

export const ORG_ID_TO_LIST_ID: Record<string, ListId> = (() => {
  const map: Record<string, ListId> = {};
  for (const loc of LOCATIONS) {
    map[loc.organization_id] = loc.list_id;
  }
  return map;
})();
