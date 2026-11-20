export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-roster-request": "1",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "offline", "Roster Lab could not be reached on this computer.");
  }
  const text = await response.text();
  const body = text ? (JSON.parse(text) as { error?: { code?: string; message?: string } }) : {};
  if (!response.ok) {
    throw new ApiError(response.status, body.error?.code ?? "error", body.error?.message ?? "The request failed.");
  }
  return body as T;
}
