"use client";

import { Birdhouse, Component, Menu, SwatchBook, UserLock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import styles from "./page.module.css";

const NAV_ITEMS = [
  { href: "/", icon: Birdhouse, label: "Home" },
  { href: "/colors", icon: SwatchBook, label: "Colors" },
  { icon: Component, label: "Components" },
];

type ConnectionStatus =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "uninitiated"
  | "unknown";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  authenticated: "#4e8f82", // green (emerald-400)
  connected: "#b3a04c",    // yellow (yellow-400)
  disconnected: "#a8736a", // red (red-400)
  uninitiated: "#d9a070",  // orange (orange-400)
  unknown: "#a66e82",      // pink (pink-400)
};

export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [status] = useState<ConnectionStatus>("unknown");
  const statusColor = STATUS_COLORS[status];

  return (
    <>
      <div className={`${styles.sideMenu} ${isOpen ? styles.sideMenuOpen : ""}`}>
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
          <a className={styles.navItem}>
            <span
              className={styles.statusDot}
              style={{ "--status-color": statusColor } as React.CSSProperties}
            />
            <span>Status</span>
          </a>
          <a className={styles.navItem}>
            <UserLock size={20} />
            <span>Authenticate</span>
          </a>
        </div>
      </div>
      {!isOpen && (
        <>
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
        </>
      )}
      {isOpen && (
        <div className={styles.sideMenuOverlay} onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
