"use client";

import { supabase } from "./supabaseClient";

// Clean base URL and fall back safely if process.env isn't resolved
const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://enterprise-hrpayroll.onrender.com";
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Assemble headers dynamically; only add Content-Type if a body exists
  const headers: Record<string, string> = {
    ...authHeader,
    ...(init.headers as Record<string, string> ?? {}),
  };

  if (init.body) {
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