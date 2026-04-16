export type T1CurrentResponse = { value: string; net: number };
export type T2CurrentResponse = { cells: Record<string, string> };
export type T5CurrentResponse = {
  rows: Array<{ id: string; category: string; ytd: string }>;
  totalNetLabel: string;
};

async function jget<T>(path: string, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("combo-auth-token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { signal, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export function fetchT1Current(orgId: string, signal?: AbortSignal) {
  return jget<T1CurrentResponse>(`/api/gopos/t1/current?org=${encodeURIComponent(orgId)}`, signal);
}

export function fetchT2Current(orgId: string, signal?: AbortSignal) {
  return jget<T2CurrentResponse>(`/api/gopos/t2/current?org=${encodeURIComponent(orgId)}`, signal);
}

export function fetchT5Current(orgId: string, signal?: AbortSignal) {
  return jget<T5CurrentResponse>(`/api/gopos/t5/current?org=${encodeURIComponent(orgId)}`, signal);
}
