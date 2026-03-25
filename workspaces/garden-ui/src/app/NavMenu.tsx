"use client";

import {
  Bird,
  Birdhouse,
  BookType,
  ChevronLeft,
  Search,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  Component,
  Disc,
  Fence,
  KeySquare,
  Lock,
  Proportions,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  RulerDimensionLine,
  SwatchBook,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { type ConnectionStatus, useStatus } from "../lib/useStatus";
import styles from "./page.module.css";

const PUBLIC_NAV_ITEMS = [
  { href: "/", icon: Birdhouse, label: "Home" },
];

const ADMIN_NAV_ITEMS = [
  { href: "/apikeys", icon: KeySquare, label: "API Keys" },
];

const ADMIN_NAV_ITEMS_END = [
  { href: "/records", icon: Disc, label: "Records" },
];

const PROTECTED_NAV_ITEMS = [
  { href: "/colors", icon: SwatchBook, label: "Colors" },
  { href: "/components", icon: Component, label: "Components" },
  { href: "/dimensions", icon: Proportions, label: "Dimensions" },
  { href: "/fonts", icon: BookType, label: "Fonts" },
  { href: "/gardens", icon: Fence, label: "Gardens", permission: "system:*" },
  { href: "/layout", icon: RulerDimensionLine, label: "Layout" },
];

const STATUS_ICONS: Record<ConnectionStatus, typeof CircleHelp> = {
  authenticated: CircleCheck,
  connected: CircleMinus,
  disconnected: CircleAlert,
  unknown: CircleHelp,
};

const STATUS_STYLES: Record<ConnectionStatus, string> = {
  authenticated: styles.statusAuthenticated,
  connected: styles.statusConnected,
  disconnected: styles.statusDisconnected,
  unknown: styles.statusUnknown,
};

//
//
// Auth Modal
//

function AuthModal({
  clearAuth,
  connectionStatus,
  login,
  onClose,
  user,
}: {
  clearAuth: () => void;
  connectionStatus: ConnectionStatus;
  login: () => void;
  onClose?: () => void;
  user: { email?: string; name?: string } | null;
}) {
  const isAuthenticated = connectionStatus === "authenticated";

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
          {user?.name && (
            <span className={styles.authHint}>{user.name}</span>
          )}
          {user?.email && !user.name && (
            <span className={styles.authHint}>{user.email}</span>
          )}
          <div className={styles.authConfirmRow}>
            <button
              className={styles.authConfirmCancel}
              onClick={() => onClose?.()}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.authConfirmSignOut}
              onClick={() => clearAuth()}
              type="button"
            >
              Sign out
            </button>
          </div>
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
            <span className={styles.statusLabel}>SIGN IN</span>
          </div>
        </div>
        <button
          className={`${styles.authSubmit} ${styles.authSubmitReady}`}
          onClick={() => login()}
          type="button"
        >
          Sign in with Auth0
        </button>
      </div>
    </div>
  );
}

//
//
// NavMenu
//

export function NavMenu({ hideMenu, onPageIconClick, pageIcon: PageIcon = Bird }: { hideMenu?: boolean; onPageIconClick?: () => void; pageIcon?: typeof Bird }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const { clearAuth, connectionStatus, login, permissions, response, user } = useStatus();
  const StatusIcon = STATUS_ICONS[connectionStatus];
  const statusStyle = STATUS_STYLES[connectionStatus];

  const isAuthenticated = connectionStatus === "authenticated";
  const isAdmin = permissions.some((p) => p === "admin:*" || p === "system:*" || p === "*");
  const hasPermission = (perm: string) => permissions.some((p) => p === perm || p === "*");
  const navItems = [
    ...PUBLIC_NAV_ITEMS,
    ...(isAdmin ? ADMIN_NAV_ITEMS : []),
    ...(isAuthenticated ? PROTECTED_NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission)) : []),
    ...(isAdmin ? ADMIN_NAV_ITEMS_END : []),
  ];
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
              {navItems.map(({ href, icon: Icon, label }) =>
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
              {connectionStatus === "authenticated" ? (
                <a
                  className={styles.navItem}
                  onClick={() => {
                    setShowAuth(true);
                    setShowStatus(false);
                  }}
                >
                  <LogOut size={20} />
                  <span>Sign out</span>
                </a>
              ) : (
                <a
                  className={styles.navItem}
                  onClick={() => login()}
                >
                  <LogIn size={20} />
                  <span>Sign in</span>
                </a>
              )}
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
                {response?.authenticated && user?.name && (
                  <div className={styles.statusMessage}>{user.name}</div>
                )}
                {response?.authenticated && user?.email && (
                  <div className={styles.statusMessage}>{user.email}</div>
                )}
              </div>
            )}
            {showAuth && (
              <AuthModal
                clearAuth={clearAuth}
                connectionStatus={connectionStatus}
                login={login}
                onClose={() => setShowAuth(false)}
                user={user}
              />
            )}
          </div>
        </div>
      )}
      {!isOpen && (
        <div className={`${styles.navBox}${hideMenu ? ` ${styles.navBoxBorderless}` : ""}`}>
          <div
            className={styles.iconButton}
            onClick={hideMenu ? undefined : () => setIsOpen(true)}
            style={hideMenu ? { visibility: "hidden" } : undefined}
          >
            <Menu size={20} />
          </div>
          <div
            className={`${styles.iconButton}${hideMenu ? ` ${styles.iconButtonGhost}` : ""}`}
            onClick={onPageIconClick}
            style={onPageIconClick ? { cursor: "pointer" } : undefined}
          >
            <PageIcon size={20} />
          </div>
        </div>
      )}
    </>
  );
}
