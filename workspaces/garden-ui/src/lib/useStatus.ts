"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_HINT_KEY = "garden-session-hint";
const STORAGE_TOKEN_KEY = "garden-session-token";

type AuthMode = "auth0" | "bypass" | null;

type ConnectionStatus =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "uninitialized"
  | "unknown";

interface SessionResponse {
  hint: string;
  token: string;
}

interface StatusMessage {
  content: string;
  level: string;
  type: string;
}

interface StatusResponse {
  authenticated: boolean;
  initialized?: boolean;
  messages?: StatusMessage[];
  mode?: "auth0" | "bypass";
  permissions?: string[];
  status: string;
  user?: { email?: string; name?: string };
}

interface StatusData {
  authenticate: (key: string) => Promise<boolean>;
  clearAuth: () => void;
  connectionStatus: ConnectionStatus;
  hint: string | null;
  login: () => void;
  mode: AuthMode;
  permissions: string[];
  response: StatusResponse | null;
  user: { email?: string; name?: string } | null;
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

function getStoredHint(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_HINT_KEY);
}

function fetchStatus(sessionToken?: string | null): Promise<StatusResponse> {
  const headers: HeadersInit = {};
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }
  return fetch("/status", { headers }).then(
    (res) => res.json() as Promise<StatusResponse>,
  );
}

function deriveConnectionStatus(data: StatusResponse): ConnectionStatus {
  if (data.status === "error") return "disconnected";
  if (data.initialized === false) return "uninitialized";
  if (data.authenticated) return "authenticated";
  return "connected";
}

export function useStatus(): StatusData {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [hint, setHint] = useState<string | null>(() => getStoredHint());
  const [mode, setMode] = useState<AuthMode>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [response, setResponse] = useState<StatusResponse | null>(null);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(
    null,
  );

  const applyResponse = useCallback((data: StatusResponse) => {
    setResponse(data);
    setConnectionStatus(deriveConnectionStatus(data));
    setMode(data.mode ?? null);
    setPermissions(data.permissions ?? []);
    setUser(data.user ?? null);
  }, []);

  useEffect(() => {
    const storedToken = getStoredToken();
    fetchStatus(storedToken)
      .then(applyResponse)
      .catch(() => {
        setConnectionStatus("disconnected");
      });
  }, [applyResponse]);

  const authenticate = useCallback(
    async (key: string): Promise<boolean> => {
      // Exchange API key for session token (bypass mode only)
      let session: SessionResponse;
      try {
        const res = await fetch("/api/bypass/session", {
          body: JSON.stringify({}),
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        if (!res.ok) {
          return false;
        }
        session = (await res.json()) as SessionResponse;
      } catch {
        return false;
      }

      // Store session token and hint (never the raw API key)
      localStorage.setItem(STORAGE_TOKEN_KEY, session.token);
      localStorage.setItem(STORAGE_HINT_KEY, session.hint);
      setHint(session.hint);

      // Fetch status with the new session token
      const data = await fetchStatus(session.token);
      applyResponse(data);
      return data.authenticated;
    },
    [applyResponse],
  );

  const clearAuth = useCallback(() => {
    if (mode === "auth0") {
      window.location.href = "/auth/logout";
      return;
    }

    // Bypass mode: clear localStorage and server session
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_HINT_KEY);
    setHint(null);

    fetch("/api/bypass/session", { method: "DELETE" }).catch(() => {
      // Best effort
    });

    fetchStatus()
      .then(applyResponse)
      .catch(() => {
        setConnectionStatus("disconnected");
      });
  }, [applyResponse, mode]);

  const login = useCallback(() => {
    window.location.href = "/auth/login";
  }, []);

  return {
    authenticate,
    clearAuth,
    connectionStatus,
    hint,
    login,
    mode,
    permissions,
    response,
    user,
  };
}

export type {
  AuthMode,
  ConnectionStatus,
  StatusData,
  StatusMessage,
  StatusResponse,
};
