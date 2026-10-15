import type { Plant, PlantInput } from "../types/plant";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const PLANTS_ENDPOINT = "/api/web/v1/plants";

type ApiEnvelope<T> = {
  data: T;
  error?: { code?: string; message?: string };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${PLANTS_ENDPOINT}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? `Request failed (${response.status}).`,
    );
  }

  return payload.data;
}

export const plantsApi = {
  list: () => request<Plant[]>(""),
  create: (input: PlantInput) =>
    request<Plant>("", { method: "POST", body: JSON.stringify(input) }),
  update: (id: number, input: PlantInput) =>
    request<Plant>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  setActive: (id: number, isActive: boolean) =>
    request<Plant>(`/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
};
