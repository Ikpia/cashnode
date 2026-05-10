"use client";

const AUTH_TOKEN_STORAGE_KEY = "cashnode_auth_token";

export function getStoredAuthToken() {
  return null;
}

export function setStoredAuthToken(token: string) {
  void token;
  clearStoredAuthToken();
}

export function clearStoredAuthToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const nextHeaders = new Headers(init.headers ?? {});

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? "same-origin",
    headers: nextHeaders
  });
}
