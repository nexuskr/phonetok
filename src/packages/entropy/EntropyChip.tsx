/**
 * EntropyChip — DEV-only floating chip showing runtime ledger state.
 *
 * Mounted from App.tsx. Tree-shaken in prod via import.meta.env.DEV guard.
 */
import { useEffect, useState } from "react";
import { counts, snapshot, subscribe, byCategory, type LedgerEntry } from "@pkg/runtime";

export default function EntropyChip() {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const c = counts();
  const cats = byCategory();

  const pct = Math.round(c.coverage * 100);
  const colorBg =
    c.coverage >= 0.7 ? "#0a2" :
    c.coverage >= 0.3 ? "#a60" : "#a22";

  return (
    <div
      style={{
        position: "fixed", right: 8, bottom: 8, zIndex: 99999,
        fontFamily: "ui-monospace, monospace", fontSize: 11,
        color: "#fff",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: colorBg,
          padding: "4px 8px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 4,
          cursor: "pointer",
          opacity: 0.85,
        }}
      >
        RUNTIME tracked {c.tracked} / entropy {c.untracked} · cov {pct}%
      </button>

      {open && (
        <div
          style={{
            marginTop: 4,
            background: "rgba(0,0,0,0.92)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 4,
            padding: 8,
            maxWidth: 520,
            maxHeight: 360,
            overflow: "auto",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ marginBottom: 6, opacity: 0.7 }}>
            money_flow {cats.money_flow.tracked}/{cats.money_flow.untracked} ·
            cosmetic {cats.cosmetic.tracked}/{cats.cosmetic.untracked} ·
            admin {cats.admin.tracked}/{cats.admin.untracked} ·
            unknown {cats.unknown.tracked}/{cats.unknown.untracked}
          </div>
          <Section title="TRACKED" entries={snapshot().tracked} />
          <Section title="ENTROPY (untracked)" entries={snapshot().untracked} />
        </div>
      )}
    </div>
  );
}

function Section({ title, entries }: { title: string; entries: LedgerEntry[] }) {
  if (entries.length === 0) return (
    <div style={{ opacity: 0.5, padding: "4px 0" }}>{title}: (empty)</div>
  );
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ opacity: 0.7, marginBottom: 2 }}>{title} ({entries.length})</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <td style={{ padding: "2px 4px", opacity: 0.8 }}>{e.category}</td>
              <td style={{ padding: "2px 4px" }}>{e.owner}</td>
              <td style={{ padding: "2px 4px", textAlign: "right", opacity: 0.7 }}>{e.intervalMs}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
