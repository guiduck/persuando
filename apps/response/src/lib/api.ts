import type { GetCurrentWorkspaceResponse, SessionHistoryResponse } from "@persuando/contracts";
import { cookies } from "next/headers";

export interface AuthMeResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    displayName: string;
    provider: "google" | "local-dev";
  };
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000";

export function googleLoginUrl(): string {
  return `${apiBaseUrl}/auth/google`;
}

export async function getCurrentUser(): Promise<AuthMeResponse> {
  return fetchApi<AuthMeResponse>("/auth/me");
}

export async function getCurrentWorkspace(): Promise<GetCurrentWorkspaceResponse | undefined> {
  try {
    return await fetchApi<GetCurrentWorkspaceResponse>("/workspaces/current");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return undefined;
    throw error;
  }
}

export async function getSessionHistory(sessionId: string): Promise<SessionHistoryResponse | undefined> {
  try {
    return await fetchApi<SessionHistoryResponse>(`/sessions/${sessionId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return undefined;
    throw error;
  }
}

async function fetchApi<TResponse>(path: string): Promise<TResponse> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${path}`);
  }

  return (await response.json()) as TResponse;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}
