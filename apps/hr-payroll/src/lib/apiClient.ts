"use client";

import { supabase } from "./supabaseClient";

// Clean base URL and fall back safely if process.env isn't resolved
const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://enterprise-hrpayroll.onrender.com";
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

/**
 * Retrieves the active Supabase Auth access token and constructs the Authorization header.
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  let { data: { session } } = await supabase.auth.getSession();

  // If session isn't loaded yet, attempt to retrieve refreshed session
  if (!session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }

  const token = session?.access_token;
  if (!token) {
    throw new Error("User is not authenticated. Missing access token.");
  }

  return { Authorization: `Bearer ${token}` };
}
/**
 * Core HTTP client. Automatically appends /api/v1 prefix if missing,
 * injects Bearer JWT, and controls Content-Type header injection.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();

  // Normalize path format and auto-prefix /api/v1 if not present
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedPath.startsWith("/api/v1") && !normalizedPath.startsWith("/health")) {
    normalizedPath = `/api/v1${normalizedPath}`;
  }

  // Construct headers cleanly
  const headers: Record<string, string> = {
    ...authHeader,
    ...(init.headers as Record<string, string> ?? {}),
  };

  if (init.body !== undefined && init.body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    headers,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error ?? `Request failed with status ${res.status}`);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};