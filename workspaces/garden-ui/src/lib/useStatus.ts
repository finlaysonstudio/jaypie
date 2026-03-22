"use client";

import { useCallback, useEffect, useState } from "react";

type ConnectionStatus =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "unknown";

interface StatusResponse {
  authenticated: boolean;
  permissions?: string[];
  session?: string;
  status: string;
  user?: { email?: string; name?: string };
}

interface StatusData {
  clearAuth: () => void;
  connectionStatus: ConnectionStatus;
  login: () => void;
  permissions: string[];
  response: StatusResponse | null;
  session: string | null;
  user: { email?: string; name?: string } | null;
}

function fetchStatus(): Promise<StatusResponse> {
  return fetch("/status").then(
    (res) => res.json() as Promise<StatusResponse>,
  );
}

function deriveConnectionStatus(data: StatusResponse): ConnectionStatus {
  if (data.status === "error") return "disconnected";
  if (data.authenticated) return "authenticated";
  return "connected";
}

export function useStatus(): StatusData {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [response, setResponse] = useState<StatusResponse | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(
    null,
  );

  const applyResponse = useCallback((data: StatusResponse) => {
    setResponse(data);
    setConnectionStatus(deriveConnectionStatus(data));
    setPermissions(data.permissions ?? []);
    setSession(data.session ?? null);
    setUser(data.user ?? null);
  }, []);

  useEffect(() => {
    fetchStatus()
      .then(applyResponse)
      .catch(() => {
        setConnectionStatus("disconnected");
      });
  }, [applyResponse]);

  const clearAuth = useCallback(() => {
    window.location.href = "/auth/logout";
  }, []);

  const login = useCallback(() => {
    window.location.href = "/auth/login";
  }, []);

  return {
    clearAuth,
    connectionStatus,
    login,
    permissions,
    response,
    session,
    user,
  };
}

export type { ConnectionStatus, StatusData, StatusResponse };
