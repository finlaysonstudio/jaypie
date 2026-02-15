"use client";

import {
  Birdhouse,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  Component,
  Lock,
  LockOpen,
  PowerOff,
  Menu,
  SwatchBook,
  UserLock,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { isValidApiKeyFormat } from "../lib/apikey/checksum";
import { type ConnectionStatus, useStatus } from "../lib/useStatus";
import styles from "./page.module.css";

const NAV_ITEMS = [
  { href: "/", icon: Birdhouse, label: "Home" },
  { href: "/colors", icon: SwatchBook, label: "Colors" },
  { icon: Component, label: "Components" },
];

const STATUS_ICONS: Record<ConnectionStatus, typeof CircleHelp> = {
  authenticated: CircleCheck,
  connected: CircleMinus,
  disconnected: CircleAlert,
  uninitialized: PowerOff,
  unknown: CircleHelp,
};

const STATUS_STYLES: Record<ConnectionStatus, string> = {
  authenticated: styles.statusAuthenticated,
  connected: styles.statusConnected,
  disconnected: styles.statusDisconnected,
  uninitialized: styles.statusUninitialized,
  unknown: styles.statusUnknown,
};

function AuthModal({
  authenticate,
  clearAuth,
  connectionStatus,
}: {
  authenticate: (key: string) => Promise<boolean>;
  clearAuth: () => void;
  connectionStatus: ConnectionStatus;
}) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isAuthenticated = connectionStatus === "authenticated";

  const isValid = apiKey.length > 0 && isValidApiKeyFormat(apiKey);
  const showInvalid = apiKey.length > 0 && !isValid;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const success = await authenticate(apiKey);
      if (!success) {
        setError("Key rejected by server");
      } else {
        setApiKey("");
      }
    } catch {
      setError("Failed to authenticate");
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthenticated) {
    const storedKey = localStorage.getItem("garden-api-key") ?? "";
    const hint = storedKey.slice(-4);
    return (
      <div
        className={styles.authModal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.statusHeaderRow}>
          <div
            className={`${styles.statusHeader} ${styles.statusAuthenticated}`}
          >
            <LockOpen className={styles.statusHeaderIcon} size={18} />
            <span className={styles.statusHeaderValue}>authenticated</span>
          </div>
        </div>
        <span className={styles.authHint}>Key: ****{hint}</span>
        <button
          className={styles.authSignOut}
          onClick={() => clearAuth()}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div
      className={styles.authModal}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.statusHeaderRow}>
        <div className={styles.statusAuthDetail}>
          <Lock className={styles.statusRowIcon} size={14} />
          <span className={styles.statusLabel}>AUTHENTICATE</span>
        </div>
      </div>
      <input
        autoFocus
        className={`${styles.authInput} ${showInvalid ? styles.authInputInvalid : ""}`}
        onChange={(e) => {
          setApiKey(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
        placeholder="sk_jpi_..."
        type="text"
        value={apiKey}
      />
      {showInvalid && (
        <span className={styles.authError}>Invalid key format</span>
      )}
      {error && <span className={styles.authError}>{error}</span>}
      <button
        className={styles.authSubmit}
        disabled={!isValid || submitting}
        onClick={handleSubmit}
        type="button"
      >
        {submitting ? "Authenticating..." : "Authenticate"}
      </button>
    </div>
  );
}

export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const { authenticate, clearAuth, connectionStatus, response } = useStatus();
  const StatusIcon = STATUS_ICONS[connectionStatus];
  const statusStyle = STATUS_STYLES[connectionStatus];

  const hasModal = showAuth || showStatus;

  return (
    <>
      {isOpen && (
        <div className={styles.menuContainer}>
          <div className={styles.sideMenu}>
            <nav className={styles.sideMenuNav}>
              {NAV_ITEMS.map(({ href, icon: Icon, label }) =>
                href ? (
                  <Link className={styles.navItem} href={href} key={label}>
                    <Icon size={20} />
                    <span>{label}</span>
                  </Link>
                ) : (
                  <a className={styles.navItem} key={label}>
                    <Icon size={20} />
                    <span>{label}</span>
                  </a>
                ),
              )}
            </nav>
            <div className={styles.sideMenuFooter}>
              <a
                className={styles.navItem}
                onClick={() => {
                  setShowStatus(!showStatus);
                  setShowAuth(false);
                }}
              >
                <StatusIcon size={20} />
                <span>Status</span>
              </a>
              <a
                className={styles.navItem}
                onClick={() => {
                  setShowAuth(!showAuth);
                  setShowStatus(false);
                }}
              >
                <UserLock size={20} />
                <span>Authenticate</span>
              </a>
            </div>
          </div>
          <div
            className={`${styles.menuCanvas} ${hasModal ? styles.menuCanvasModal : ""}`}
            onClick={() => {
              setIsOpen(false);
              setShowAuth(false);
              setShowStatus(false);
            }}
          >
            {showStatus && (
              <div
                className={styles.statusModal}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.statusHeaderRow}>
                  <div className={`${styles.statusHeader} ${statusStyle}`}>
                    <StatusIcon className={styles.statusHeaderIcon} size={18} />
                    <span className={styles.statusHeaderValue}>
                      {connectionStatus}
                    </span>
                  </div>
                  <div className={styles.statusAuthDetail}>
                    {response?.authenticated ? (
                      <LockOpen className={styles.statusRowIcon} size={14} />
                    ) : (
                      <Lock className={styles.statusRowIcon} size={14} />
                    )}
                    <span className={styles.statusLabel}>
                      {response?.authenticated ? "" : "NOT "}AUTHENTICATED
                    </span>
                  </div>
                </div>
                {response?.messages?.map((msg, i) => (
                  <div className={styles.statusMessage} key={i}>
                    {msg.content}
                  </div>
                ))}
              </div>
            )}
            {showAuth && (
              <AuthModal
                authenticate={authenticate}
                clearAuth={clearAuth}
                connectionStatus={connectionStatus}
              />
            )}
          </div>
        </div>
      )}
      {!isOpen && (
        <div className={styles.navBox}>
          <div
            className={styles.iconButton}
            onClick={() => setIsOpen(true)}
          >
            <Menu size={20} />
          </div>
          <div className={styles.iconButton}>
            <Birdhouse size={18} />
          </div>
        </div>
      )}
    </>
  );
}
