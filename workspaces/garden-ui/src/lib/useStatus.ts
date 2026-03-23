"use client";

import { useCallback, useEffect, useState } from "react";

const DEVICE_ID_KEY = "garden-device-id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

type ConnectionStatus =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "unknown";

interface ContextData {
  authenticated: boolean;
  permissions?: string[];
  session?: string;
  user?: { email?: string; name?: string };
}

interface ContextResponse {
  data?: ContextData;
  errors?: { detail: string; status: number; title: string }[];
}

interface StatusData {
  clearAuth: () => void;
  connectionStatus: ConnectionStatus;
  login: () => void;
  permissions: string[];
  response: ContextData | null;
  session: string | null;
  user: { email?: string; name?: string } | null;
}

function fetchContext(): Promise<ContextResponse> {
  const headers: HeadersInit = {};
  const deviceId = getDeviceId();
  if (deviceId) {
    headers["x-device-id"] = deviceId;
  }
  return fetch("/context", { headers }).then(
    (res) => res.json() as Promise<ContextResponse>,
  );
}

function deriveConnectionStatus(res: ContextResponse): ConnectionStatus {
  if (res.errors) return "disconnected";
  if (res.data?.authenticated) return "authenticated";
  return "connected";
}

export function useStatus(): StatusData {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [response, setResponse] = useState<ContextData | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(
    null,
  );

  const applyResponse = useCallback((res: ContextResponse) => {
    setConnectionStatus(deriveConnectionStatus(res));
    if (res.data) {
      setResponse(res.data);
      setPermissions(res.data.permissions ?? []);
      setSession(res.data.session ?? null);
      setUser(res.data.user ?? null);
    }
  }, []);

  useEffect(() => {
    fetchContext()
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

export type { ConnectionStatus, ContextData, StatusData };
