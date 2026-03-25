"use client";

import { Copy, CopyCheck, KeySquare, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { NavMenu } from "../NavMenu";

import styles from "./apikeys.module.css";

//
//
// Types
//

interface ApiKeyItem {
  createdAt: string;
  garden?: string;
  id: string;
  label: string;
  name: string;
  permissions: string[];
}

interface CreatedKey {
  garden?: string;
  key: string;
  label: string;
  name: string;
  permissions: string[];
}

interface GardenItem {
  id: string;
  name: string;
}

//
//
// Page
//

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [gardens, setGardens] = useState<GardenItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null);
  const [name, setName] = useState("");
  const [garden, setGarden] = useState("");

  const refreshKeys = async () => {
    const res = await fetch("/api/apikeys");
    const json = await res.json();
    if (json.data) setKeys(json.data);
  };

  useEffect(() => {
    refreshKeys().catch(() => {});
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
      const res = await fetch("/api/apikeys", {
        body: JSON.stringify({
          ...(garden ? { garden } : {}),
          name: name || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = await res.json();
      if (json.data) {
        setCreatedKey(json.data);
        setName("");
        setGarden("");
        await refreshKeys();
      }
    } catch {
      // Best effort
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch("/api/apikeys", {
        body: JSON.stringify({ id: deleteTarget.id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      setDeleteTarget(null);
      await refreshKeys();
    } catch {
      // Best effort
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const gardenName = (gardenId: string) =>
    gardens.find((g) => g.id === gardenId)?.name ?? gardenId.slice(0, 8);

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
        {gardens.length > 0 && (
          <select
            className={styles.gardenSelect}
            onChange={(e) => setGarden(e.target.value)}
            value={garden}
          >
            <option value="">No garden</option>
            {gardens.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
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
                {item.garden ? ` · ${gardenName(item.garden)}` : ""}
              </span>
              {item.permissions.length > 0 && (
                <span className={styles.keyMeta}>
                  {item.permissions.join(", ")}
                </span>
              )}
            </div>
            <button
              className={styles.deleteButton}
              onClick={() => setDeleteTarget(item)}
              title="Delete key"
              type="button"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div className={styles.modalOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Delete API key?</div>
            <div className={styles.modalHint}>
              {deleteTarget.name} (xxxxxxxx_{deleteTarget.label})
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.modalDelete}
                onClick={handleDelete}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
