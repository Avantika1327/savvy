const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/web/v1";

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

/** Shared fetch wrapper for the Super Admin API. Session cookies are sent by the browser. */
export async function platformRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(
      "Unable to connect to the API. Check your connection and try again.",
    );
  }

  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload;
    if (response.status === 401) {
      throw new Error("Your session may have expired. Please sign in again.");
    }
    if (response.status === 403) {
      throw new Error("You do not have permission to perform this action.");
    }
    throw new Error(errorPayload?.error?.message ?? "Request failed.");
  }

  return payload as T;
}
