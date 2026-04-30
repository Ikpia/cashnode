"use client";

const AUTH_TOKEN_STORAGE_KEY = "cashnode_auth_token";

export function getStoredAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return token?.trim() || null;
}

export function setStoredAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAuthToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getStoredAuthToken();
  const nextHeaders = new Headers(init.headers ?? {});

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers: nextHeaders
  });
}
