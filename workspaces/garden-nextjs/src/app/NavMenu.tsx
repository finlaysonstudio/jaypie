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

export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const { connectionStatus, response } = useStatus();
  const StatusIcon = STATUS_ICONS[connectionStatus];
  const statusStyle = STATUS_STYLES[connectionStatus];

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
                onClick={() => setShowStatus(!showStatus)}
              >
                <StatusIcon size={20} />
                <span>Status</span>
              </a>
              <a className={styles.navItem}>
                <UserLock size={20} />
                <span>Authenticate</span>
              </a>
            </div>
          </div>
          <div
            className={`${styles.menuCanvas} ${showStatus ? styles.menuCanvasModal : ""}`}
            onClick={() => {
              setIsOpen(false);
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
