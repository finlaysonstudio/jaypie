"use client";

import { Fence } from "lucide-react";
import { useEffect, useState } from "react";

import { NavMenu } from "../NavMenu";

import styles from "./gardens.module.css";

//
//
// Types
//

interface GardenItem {
  createdAt: string;
  id: string;
  name: string;
  xid: string;
}

//
//
// Page
//

export default function GardensPage() {
  const [gardens, setGardens] = useState<GardenItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/gardens")
      .then((res) => res.json())
      .then((res) => {
        if (res.data) setGardens(res.data);
      })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/gardens", {
        body: JSON.stringify({ name: name || undefined }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = await res.json();
      if (json.data) {
        setName("");
        // Refresh list
        const listRes = await fetch("/api/gardens");
        const listJson = await listRes.json();
        if (listJson.data) setGardens(listJson.data);
      }
    } catch {
      // Best effort
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.page}>
      <NavMenu pageIcon={Fence} />
      <h1 className={styles.title}>Gardens</h1>

      <div className={styles.createRow}>
        <input
          className={styles.nameInput}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="Garden name"
          type="text"
          value={name}
        />
        <button
          className={styles.createButton}
          disabled={creating}
          onClick={handleCreate}
          type="button"
        >
          {creating ? "Creating..." : "Create Garden"}
        </button>
      </div>

      <div className={styles.gardenList}>
        {gardens.length === 0 && (
          <div className={styles.empty}>No gardens yet.</div>
        )}
        {gardens.map((item) => (
          <div className={styles.gardenItem} key={item.id}>
            <Fence className={styles.gardenIcon} size={16} />
            <div className={styles.gardenInfo}>
              <span className={styles.gardenName}>{item.name}</span>
              <span className={styles.gardenMeta}>
                {new Date(item.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
