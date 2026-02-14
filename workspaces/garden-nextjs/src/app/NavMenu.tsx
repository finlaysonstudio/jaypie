"use client";

import { Birdhouse, Component, Menu, SwatchBook, UserLock } from "lucide-react";
import { useState } from "react";

import styles from "./page.module.css";

const NAV_ITEMS = [
  { icon: Birdhouse, label: "Home" },
  { icon: SwatchBook, label: "Colors" },
  { icon: Component, label: "Components" },
];

export function NavMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className={`${styles.sideMenu} ${isOpen ? styles.sideMenuOpen : ""}`}>
        <nav className={styles.sideMenuNav}>
          {NAV_ITEMS.map(({ icon: Icon, label }) => (
            <a className={styles.navItem} key={label}>
              <Icon size={20} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className={styles.sideMenuFooter}>
          <a className={styles.navItem}>
            <UserLock size={20} />
            <span>Authenticate</span>
          </a>
        </div>
      </div>
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
      {isOpen && (
        <div className={styles.sideMenuOverlay} onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
