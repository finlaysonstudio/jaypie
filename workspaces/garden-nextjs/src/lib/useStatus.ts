"use client";

import { useEffect, useState } from "react";

type ConnectionStatus =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "uninitiated"
  | "unknown";

interface StatusMessage {
  content: string;
  level: string;
  type: string;
}

interface StatusResponse {
  authenticated: boolean;
  initiated?: boolean;
  messages?: StatusMessage[];
  status: string;
}

interface StatusData {
  connectionStatus: ConnectionStatus;
  response: StatusResponse | null;
}

export function useStatus(): StatusData {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [response, setResponse] = useState<StatusResponse | null>(null);

  useEffect(() => {
    fetch("/status")
      .then((res) => res.json() as Promise<StatusResponse>)
      .then((data) => {
        setResponse(data);
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

  return { connectionStatus, response };
}

export type { ConnectionStatus, StatusData, StatusMessage, StatusResponse };
