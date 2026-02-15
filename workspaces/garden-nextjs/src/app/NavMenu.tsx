"use client";

import {
  Birdhouse,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  CircleHelp,
  CircleMinus,
  Component,
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
  uninitiated: CircleSlash,
  unknown: CircleHelp,
};

export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const { connectionStatus, response } = useStatus();
  const StatusIcon = STATUS_ICONS[connectionStatus];

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
            className={styles.menuCanvas}
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
                <div className={styles.statusRow}>
                  <StatusIcon size={16} />
                  <span className={styles.statusLabel}>Status</span>
                  <span className={styles.statusValue}>{connectionStatus}</span>
                </div>
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Authenticated</span>
                  <span className={styles.statusValue}>
                    {response?.authenticated ? "yes" : "no"}
                  </span>
                </div>
                {response?.initiated === false && (
                  <div className={styles.statusRow}>
                    <span className={styles.statusLabel}>Initiated</span>
                    <span className={styles.statusValue}>no</span>
                  </div>
                )}
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
