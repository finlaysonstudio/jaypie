"use client";

import { ChevronLeft, ChevronRight, Disc, Filter, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { NavMenu } from "../NavMenu";

import styles from "./records.module.css";

//
//
// Types
//

interface RecordItem {
  [key: string]: unknown;
  id: string;
  model: string;
}

//
//
// Page
//

export default function RecordsPage() {
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("");
  const [scope, setScope] = useState("@");
  const [index, setIndex] = useState("");
  const [value, setValue] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [nextKey, setNextKey] = useState<string | null>(null);
  const [pageKeys, setPageKeys] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecords = useCallback(
    async (startKey?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (model) params.set("model", model);
        if (model) params.set("scope", scope);
        if (index && value) {
          params.set("index", index);
          params.set("value", value);
        }
        if (startKey) {
          params.set("startKey", startKey);
        }

        const res = await fetch(`/api/records?${params}`);
        const json = await res.json();
        if (json.data) {
          setRecords(json.data);
          setNextKey(json.nextKey ?? null);
        }
      } catch {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    },
    [index, model, scope, value],
  );

  // Load all records on mount
  useEffect(() => {
    fetchRecords();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuery = () => {
    setPageKeys([]);
    setNextKey(null);
    fetchRecords();
  };

  const handleNextPage = () => {
    if (!nextKey) return;
    setPageKeys((prev) => [...prev, nextKey]);
    fetchRecords(nextKey);
  };

  const handlePrevPage = () => {
    if (pageKeys.length === 0) return;
    const newKeys = [...pageKeys];
    newKeys.pop();
    setPageKeys(newKeys);
    const prevKey = newKeys[newKeys.length - 1];
    fetchRecords(prevKey);
  };

  const handleClearFilters = () => {
    setModel("");
    setScope("@");
    setIndex("");
    setValue("");
    setShowFilters(false);
    setPageKeys([]);
    setNextKey(null);
    // Fetch all records
    setLoading(true);
    fetch("/api/records")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setRecords(json.data);
          setNextKey(json.nextKey ?? null);
        }
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  };

  const DETAIL_FIELDS = ["abbreviation", "alias", "label", "xid"] as const;

  function formatDateTime(iso: unknown): string {
    if (typeof iso !== "string") return "";
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = String(h % 12 || 12).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${mm}/${dd}/${yyyy} ${hh}:${mi}:${ss} ${ampm}`;
  }

  function isModified(record: RecordItem): boolean {
    const created = record.createdAt as string | undefined;
    const updated = record.updatedAt as string | undefined;
    if (!created || !updated) return false;
    return new Date(updated).getTime() - new Date(created).getTime() > 1000;
  }

  return (
    <div className={styles.page}>
      <NavMenu pageIcon={Disc} />
      <h1 className={styles.title}>Records</h1>

      <div className={styles.filterBar}>
        <button
          className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ""}`}
          onClick={() => setShowFilters(!showFilters)}
          type="button"
        >
          <Filter size={14} />
          <span>Filter</span>
        </button>
      </div>

      {showFilters && (
        <div className={styles.filters}>
          <input
            className={`${styles.filterInput} ${styles.filterInputModel}`}
            onChange={(e) => setModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuery();
            }}
            placeholder="model"
            type="text"
            value={model}
          />
          <input
            className={`${styles.filterInput} ${styles.filterInputScope}`}
            onChange={(e) => setScope(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuery();
            }}
            placeholder="scope (@)"
            type="text"
            value={scope}
          />
          <select
            className={styles.filterSelect}
            onChange={(e) => setIndex(e.target.value)}
            value={index}
          >
            <option value="">scope (default)</option>
            <option value="alias">alias</option>
            <option value="category">category</option>
            <option value="type">type</option>
            <option value="xid">xid</option>
          </select>
          {index && (
            <input
              className={`${styles.filterInput} ${styles.filterInputValue}`}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuery();
              }}
              placeholder={`${index} value`}
              type="text"
              value={value}
            />
          )}
          <button
            className={styles.filterButton}
            disabled={loading}
            onClick={handleQuery}
            type="button"
          >
            <Search size={14} />
          </button>
          <button
            className={styles.filterButton}
            onClick={handleClearFilters}
            type="button"
          >
            Clear
          </button>
        </div>
      )}

      {loading && <div className={styles.loading}>Loading...</div>}

      {!loading && records.length === 0 && (
        <div className={styles.empty}>No records found.</div>
      )}

      {!loading && records.length > 0 && (
        <>
          <div className={styles.cardList}>
            {records.map((record, i) => (
              <div className={styles.card} key={record.id ?? i}>
                <div className={styles.cardLeft}>
                  {record.name ? (
                    <div className={styles.cardRow}>
                      <span className={styles.cardName}>{String(record.name)}</span>
                    </div>
                  ) : null}
                  <div className={styles.cardRow}>
                    <span className={styles.cardModel}>{record.model}</span>
                    <span className={styles.cardId}>{record.id}</span>
                  </div>
                  <div className={styles.cardDetails}>
                    {DETAIL_FIELDS.map((field) => {
                      const val = record[field];
                      if (val === undefined || val === null) return null;
                      return (
                        <span className={styles.cardDetail} key={field}>
                          <span className={styles.cardDetailKey}>{field}:</span>
                          <span className={styles.cardDetailValue} title={String(val)}>
                            {String(val)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.cardRight}>
                  <span className={styles.cardDate}>{formatDateTime(isModified(record) ? record.updatedAt : record.createdAt)}</span>
                  {isModified(record) && (
                    <span className={styles.cardDate}>{formatDateTime(record.createdAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.pagination}>
            {pageKeys.length > 0 && (
              <button
                className={styles.filterButton}
                onClick={handlePrevPage}
                type="button"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            {nextKey && (
              <button
                className={styles.filterButton}
                onClick={handleNextPage}
                type="button"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
