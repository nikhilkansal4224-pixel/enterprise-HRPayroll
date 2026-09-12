"use client";

import { supabase } from "./supabaseClient";

// Clean base URL and fall back safely if process.env isn't resolved
const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://enterprise-hrpayroll.onrender.com";
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

/**
 * Retrieves the active Supabase Auth access token with dynamic refresh.
 * Throws a clear error if the user is unauthenticated to halt unbearerized API requests.
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  let { data: { session } } = await supabase.auth.getSession();

  // Attempt to refresh session if session is not immediately ready
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
 * Core HTTP client using standard Headers API to prevent casing mismatches.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Normalize path format and auto-prefix /api/v1 if missing
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!normalizedPath.startsWith("/api/v1") && !normalizedPath.startsWith("/health")) {
    normalizedPath = `/api/v1${normalizedPath}`;
  }

  const headers = new Headers(init.headers);

  // Exclude auth headers for public health checks if applicable
  if (!normalizedPath.startsWith("/health")) {
    const authHeader = await getAuthHeader();
    if (authHeader.Authorization) {
      headers.set("Authorization", authHeader.Authorization);
    }
  }

  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
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