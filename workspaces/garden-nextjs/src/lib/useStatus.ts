"use client";

import { useEffect, useState } from "react";

type ConnectionStatus =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "uninitiated"
  | "unknown";

interface StatusResponse {
  authenticated: boolean;
  initiated?: boolean;
  status: string;
}

export function useStatus(): ConnectionStatus {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");

  useEffect(() => {
    fetch("/status")
      .then((res) => res.json() as Promise<StatusResponse>)
      .then((data) => {
        if (data.status === "error") {
          setConnectionStatus("disconnected");
        } else if (data.initiated === false) {
          setConnectionStatus("uninitiated");
        } else if (data.authenticated) {
          setConnectionStatus("authenticated");
        } else {
          setConnectionStatus("connected");
        }
      })
      .catch(() => {
        setConnectionStatus("disconnected");
      });
  }, []);

  return connectionStatus;
}

export type { ConnectionStatus };
