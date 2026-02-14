"use client";

import {
  Birdhouse,
  CircleAlert,
  CircleCheck,
  CircleDot,
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
  uninitiated: CircleDot,
  unknown: CircleHelp,
};

export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const status = useStatus();
  const StatusIcon = STATUS_ICONS[status];

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
            <StatusIcon size={20} />
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
