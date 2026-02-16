"use client";

import {
  Ban,
  Birdhouse,
  ChevronLeft,
  Search,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  Component,
  Lock,
  Proportions,
  KeyRound,
  Menu,
  PowerOff,
  SwatchBook,
  UserLock,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { isValidApiKeyFormat } from "../lib/apikey/checksum";
import { type ConnectionStatus, useStatus } from "../lib/useStatus";
import styles from "./page.module.css";

const NAV_ITEMS = [
  { href: "/", icon: Birdhouse, label: "Home" },
  { href: "/colors", icon: SwatchBook, label: "Colors" },
  { icon: Component, label: "Components" },
  { href: "/dimensions", icon: Proportions, label: "Dimensions" },
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
  hint,
}: {
  authenticate: (key: string) => Promise<boolean>;
  clearAuth: () => void;
  connectionStatus: ConnectionStatus;
  hint: string | null;
}) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const isAuthenticated = connectionStatus === "authenticated";

  const isValid = apiKey.length > 0 && isValidApiKeyFormat(apiKey);
  const showInvalid = attempted && apiKey.length > 0 && !isValid;

  const handleSubmit = async () => {
    setAttempted(true);
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const success = await authenticate(apiKey);
      if (!success) {
        setError("Invalid key");
      } else {
        setApiKey("");
      }
    } catch {
      setError("Failed to authenticate");
    } finally {
      setSubmitting(false);
    }
  };

  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (isValid && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleSubmit();
    }
    if (!isValid) {
      autoSubmittedRef.current = false;
    }
  }, [isValid]);

  if (isAuthenticated) {
    return (
      <div className={styles.authWrapper} onClick={(e) => e.stopPropagation()}>
        <div className={styles.authModal}>
          <div className={styles.statusHeaderRow}>
            <div
              className={`${styles.statusHeader} ${styles.statusAuthenticated}`}
            >
              <KeyRound className={styles.statusHeaderIcon} size={18} />
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
      </div>
    );
  }

  return (
    <div className={styles.authWrapper} onClick={(e) => e.stopPropagation()}>
      <div className={styles.authModal}>
        <div className={styles.statusHeaderRow}>
          <div className={styles.statusAuthDetail}>
            <Lock className={styles.statusRowIcon} size={14} />
            <span className={styles.statusLabel}>AUTHENTICATE</span>
          </div>
        </div>
        <input
          autoFocus
          className={`${styles.authInput}${showInvalid ? ` ${styles.authInputInvalid}` : ""}`}
          onChange={(e) => {
            setApiKey(e.target.value);
            setAttempted(false);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="sk_jpi_..."
          type="text"
          value={apiKey}
        />
        <button
          className={`${styles.authSubmit}${isValid ? ` ${styles.authSubmitReady}` : ""}`}
          disabled={submitting}
          onClick={handleSubmit}
          type="button"
        >
          {submitting ? "Authenticating..." : "Authenticate"}
        </button>
      </div>
      <div className={`${styles.authError}${showInvalid || error ? ` ${styles.authErrorVisible}` : ""}`}>
        <Ban size={20} />
        <span>{showInvalid ? "Invalid key" : error || "\u00A0"}</span>
      </div>
    </div>
  );
}

export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const { authenticate, clearAuth, connectionStatus, hint: sessionHint, response } = useStatus();
  const StatusIcon = STATUS_ICONS[connectionStatus];
  const statusStyle = STATUS_STYLES[connectionStatus];

  const hasModal = showAuth || showStatus;

  return (
    <>
      {isOpen && (
        <div className={styles.menuContainer}>
          <div className={styles.sideMenu}>
            <div className={styles.sideMenuHeader}>
              <div
                className={styles.iconButton}
                onClick={() => {
                  setIsOpen(false);
                  setShowAuth(false);
                  setShowStatus(false);
                }}
              >
                <ChevronLeft size={20} />
              </div>
              <div className={styles.searchBox}>
                <input
                  className={styles.searchInput}
                  type="text"
                />
                <Search className={styles.searchIcon} size={16} />
              </div>
            </div>
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
                      <KeyRound className={styles.statusRowIcon} size={14} />
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
                hint={sessionHint}
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
