"use client";

import { Copy, CopyCheck, KeySquare, X } from "lucide-react";
import { useEffect, useState } from "react";

import { NavMenu } from "../NavMenu";

import styles from "./apikeys.module.css";

//
//
// Types
//

interface ApiKeyItem {
  createdAt: string;
  id: string;
  label: string;
  name: string;
  permissions: string[];
}

interface CreatedKey {
  key: string;
  label: string;
  name: string;
  permissions: string[];
}

//
//
// Page
//

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/apikeys")
      .then((res) => res.json())
      .then((res) => {
        if (res.data) setKeys(res.data);
      })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/apikeys", {
        body: JSON.stringify({ name: name || undefined }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = await res.json();
      if (json.data) {
        setCreatedKey(json.data);
        setName("");
        // Refresh list
        const listRes = await fetch("/api/apikeys");
        const listJson = await listRes.json();
        if (listJson.data) setKeys(listJson.data);
      }
    } catch {
      // Best effort
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.page}>
      <NavMenu pageIcon={KeySquare} />
      <h1 className={styles.title}>API Keys</h1>

      <div className={styles.createRow}>
        <input
          className={styles.nameInput}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="Key name (optional)"
          type="text"
          value={name}
        />
        <button
          className={styles.createButton}
          disabled={creating}
          onClick={handleCreate}
          type="button"
        >
          {creating ? "Creating..." : "Create Key"}
        </button>
      </div>

      {createdKey && (
        <div className={styles.reveal}>
          <button
            className={styles.revealDismiss}
            onClick={() => setCreatedKey(null)}
            type="button"
          >
            <X size={16} />
          </button>
          <div className={styles.revealLabel}>
            {createdKey.name}
          </div>
          <div className={styles.revealKey}>
            <span className={styles.revealKeyText}>{createdKey.key}</span>
            <button
              className={styles.revealCopy}
              onClick={() => handleCopy(createdKey.key)}
              type="button"
            >
              {copied ? <CopyCheck size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className={styles.revealWarning}>
            Copy this key now. It will not be shown again.
          </div>
        </div>
      )}

      <div className={styles.keyList}>
        {keys.length === 0 && (
          <div className={styles.empty}>No API keys created yet.</div>
        )}
        {keys.map((item) => (
          <div className={styles.keyItem} key={item.id}>
            <KeySquare className={styles.keyIcon} size={16} />
            <div className={styles.keyInfo}>
              <span className={styles.keyName}>{item.name}</span>
              <span className={styles.keyMeta}>
                xxxxxxxx_{item.label} &middot; {new Date(item.createdAt).toLocaleDateString()}
              </span>
              {item.permissions.length > 0 && (
                <span className={styles.keyMeta}>
                  {item.permissions.join(", ")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
