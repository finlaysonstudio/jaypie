"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "garden-api-key";

type ConnectionStatus =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "uninitialized"
  | "unknown";

interface StatusMessage {
  content: string;
  level: string;
  type: string;
}

interface StatusResponse {
  authenticated: boolean;
  initialized?: boolean;
  messages?: StatusMessage[];
  status: string;
}

interface StatusData {
  authenticate: (key: string) => Promise<boolean>;
  clearAuth: () => void;
  connectionStatus: ConnectionStatus;
  response: StatusResponse | null;
}

function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function fetchStatus(apiKey?: string | null): Promise<StatusResponse> {
  const headers: HeadersInit = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
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
  const [response, setResponse] = useState<StatusResponse | null>(null);

  const applyResponse = useCallback((data: StatusResponse) => {
    setResponse(data);
    setConnectionStatus(deriveConnectionStatus(data));
  }, []);

  useEffect(() => {
    const storedKey = getStoredKey();
    fetchStatus(storedKey)
      .then(applyResponse)
      .catch(() => {
        setConnectionStatus("disconnected");
      });
  }, [applyResponse]);

  const authenticate = useCallback(
    async (key: string): Promise<boolean> => {
      const data = await fetchStatus(key);
      applyResponse(data);
      if (data.authenticated) {
        localStorage.setItem(STORAGE_KEY, key);
        return true;
      }
      return false;
    },
    [applyResponse],
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    fetchStatus()
      .then(applyResponse)
      .catch(() => {
        setConnectionStatus("disconnected");
      });
  }, [applyResponse]);

  return { authenticate, clearAuth, connectionStatus, response };
}

export type { ConnectionStatus, StatusData, StatusMessage, StatusResponse };
