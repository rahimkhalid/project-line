import { useState, useRef, useCallback } from "react";

// ---------- Design tokens ----------
const COLORS = {
  bg: "#14181F",
  bgPanel: "#1B212B",
  bgPanelRaised: "#212834",
  border: "#2C3441",
  textPrimary: "#F5F3EE",
  textMuted: "#9AA3B2",
  textFaint: "#5B6472",
  amber: "#F2A33D",
  amberDim: "#5B4424",
  teal: "#4FB7B3",
  tealDim: "#1F3C3A",
};

const FONT_DISPLAY =
  '"Bahnschrift", "DIN Alternate", "Arial Narrow Bold", "Helvetica Neue", sans-serif';
const FONT_BODY =
  '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

// ---------- Helpers ----------
let idCounter = 1;
function makeId() {
  return `P-${String(idCounter++).padStart(3, "0")}`;
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- App ----------
export default function App() {
  const [participants, setParticipants] = useState([]);

  // Derived lists — single source of truth, no drift possible
  const waiting = participants
    .filter((p) => p.status === "waiting")
    .sort((a, b) => a.registeredAt - b.registeredAt);
  const selected = participants.find((p) => p.status === "selected") || null;
  const current = participants.find((p) => p.status === "current") || null;

  const registerParticipant = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setParticipants((prev) => [
      ...prev,
      {
        id: makeId(),
        name: trimmed,
        status: "waiting",
        registeredAt: Date.now(),
      },
    ]);
  }, []);

  const selectNext = useCallback(() => {
    setParticipants((prev) => {
      if (prev.some((p) => p.status === "selected")) return prev; // already one selected
      const front = prev
        .filter((p) => p.status === "waiting")
        .sort((a, b) => a.registeredAt - b.registeredAt)[0];
      if (!front) return prev;
      return prev.map((p) =>
        p.id === front.id ? { ...p, status: "selected" } : p
      );
    });
  }, []);

  const callNext = useCallback(() => {
    setParticipants((prev) => {
      let working = prev;
      const hasSelected = working.some((p) => p.status === "selected");

      // Auto-select front of queue if nobody is selected yet
      if (!hasSelected) {
        const front = working
          .filter((p) => p.status === "waiting")
          .sort((a, b) => a.registeredAt - b.registeredAt)[0];
        if (!front) return prev; // nobody to call
        working = working.map((p) =>
          p.id === front.id ? { ...p, status: "selected" } : p
        );
      }

      // Promote selected -> current, current -> served
      return working.map((p) => {
        if (p.status === "current") return { ...p, status: "served" };
        if (p.status === "selected") return { ...p, status: "current" };
        return p;
      });
    });
  }, []);

  // "Empty" means the visible queue has nothing in it right now — served
  // history doesn't count, since served participants drop out of view.
  const isEmpty = !current && !selected && waiting.length === 0;

  return (
    <div style={styles.app}>
      <div style={styles.mainGrid}>
        <div style={styles.leftCol}>
          <NowServing current={current} />
          <SelectedNext
            selected={selected}
            onSelectNext={selectNext}
            onCall={callNext}
            canSelect={!selected && waiting.length > 0}
            canCall={Boolean(selected) || waiting.length > 0}
          />
        </div>

        <div style={styles.rightCol}>
          <QueueList waiting={waiting} />
          <RegisterForm onRegister={registerParticipant} />
        </div>
      </div>

      {isEmpty && <EmptyOverlay />}
    </div>
  );
}

// ---------- Now Serving ----------
function NowServing({ current }) {
  return (
    <section style={styles.nowServingPanel} aria-live="polite">
      <div style={styles.eyebrow(COLORS.amber)}>NOW SERVING</div>
      {current ? (
        <div style={styles.nowServingContent}>
          <div style={styles.nowServingId}>{current.id}</div>
          <div style={styles.nowServingName}>{current.name}</div>
        </div>
      ) : (
        <div style={styles.nowServingEmpty}>
          <div style={styles.nowServingEmptyGlyph}>—</div>
          <div style={styles.nowServingEmptyText}>
            No one being seen right now
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- Selected / Up Next ----------
function SelectedNext({ selected, onSelectNext, onCall, canSelect, canCall }) {
  return (
    <section style={styles.selectedPanel}>
      <div style={styles.selectedTop}>
        <div style={styles.eyebrow(COLORS.teal)}>UP NEXT</div>
        {selected ? (
          <div style={styles.selectedRow}>
            <span style={styles.selectedBadge}>Up Next →</span>
            <span style={styles.selectedName}>{selected.name}</span>
            <span style={styles.selectedId}>{selected.id}</span>
          </div>
        ) : (
          <div style={styles.selectedEmptyText}>No one selected yet</div>
        )}
      </div>

      <div style={styles.controlRow}>
        <button
          onClick={onSelectNext}
          disabled={!canSelect}
          style={styles.btn(COLORS.teal, !canSelect)}
        >
          Select Next
        </button>
        <button
          onClick={onCall}
          disabled={!canCall}
          style={styles.btn(COLORS.amber, !canCall)}
        >
          Call
        </button>
      </div>
    </section>
  );
}

// ---------- Waiting list ----------
function QueueList({ waiting }) {
  return (
    <section style={styles.queuePanel}>
      <div style={styles.queueHeader}>
        <div style={styles.eyebrow(COLORS.textMuted)}>WAITING</div>
        <div style={styles.queueCount}>{waiting.length}</div>
      </div>

      {waiting.length === 0 ? (
        <div style={styles.queueEmpty}>Queue is empty</div>
      ) : (
        <ol style={styles.queueList}>
          {waiting.map((p, i) => (
            <li key={p.id} style={styles.queueItem}>
              <span style={styles.queuePosition}>{i + 1}</span>
              <span style={styles.queueName}>{p.name}</span>
              <span style={styles.queueId}>{p.id}</span>
              <span style={styles.queueTime}>{formatClock(p.registeredAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------- Registration (staff-facing, kept small) ----------
function RegisterForm({ onRegister }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegister(name);
    setName("");
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} style={styles.registerForm}>
      <div style={styles.registerLabel}>Check in</div>
      <div style={styles.registerRow}>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={styles.registerInput}
          autoComplete="off"
        />
        <button
          type="submit"
          style={styles.registerBtn}
          disabled={!name.trim()}
        >
          Add
        </button>
      </div>
    </form>
  );
}

// ---------- Empty state ----------
function EmptyOverlay() {
  return (
    <div style={styles.emptyOverlay}>
      <div style={styles.emptyOverlayGlyph}>○</div>
      <div style={styles.emptyOverlayTitle}>Nothing in the queue</div>
      <div style={styles.emptyOverlaySub}>
        Check someone in using the panel in the corner to get started.
      </div>
    </div>
  );
}

// ---------- Styles ----------
const styles = {
  app: {
    position: "relative",
    width: "100%",
    minHeight: "100vh",
    background: COLORS.bg,
    fontFamily: FONT_BODY,
    color: COLORS.textPrimary,
    padding: "28px",
    boxSizing: "border-box",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2.1fr) minmax(280px, 1fr)",
    gap: "24px",
    height: "calc(100vh - 56px)",
  },
  leftCol: {
    display: "grid",
    gridTemplateRows: "1fr auto",
    gap: "20px",
    minWidth: 0,
  },
  rightCol: {
    display: "grid",
    gridTemplateRows: "1fr auto",
    gap: "20px",
    minWidth: 0,
  },

  eyebrow: (color) => ({
    fontFamily: FONT_BODY,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "0.18em",
    color,
    marginBottom: "14px",
  }),

  // Now Serving
  nowServingPanel: {
    background: COLORS.bgPanel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "40px 48px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    boxShadow: `inset 0 0 0 1px rgba(242,163,61,0.04)`,
  },
  nowServingContent: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  nowServingId: {
    fontFamily: FONT_DISPLAY,
    fontVariantNumeric: "tabular-nums",
    fontSize: "clamp(64px, 11vw, 150px)",
    fontWeight: 800,
    lineHeight: 0.95,
    color: COLORS.amber,
    letterSpacing: "0.01em",
  },
  nowServingName: {
    fontFamily: FONT_BODY,
    fontSize: "clamp(32px, 5vw, 64px)",
    fontWeight: 700,
    color: COLORS.textPrimary,
    lineHeight: 1.1,
  },
  nowServingEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
  },
  nowServingEmptyGlyph: {
    fontFamily: FONT_DISPLAY,
    fontSize: "72px",
    color: COLORS.textFaint,
    lineHeight: 1,
  },
  nowServingEmptyText: {
    fontSize: "clamp(22px, 3vw, 34px)",
    fontWeight: 600,
    color: COLORS.textMuted,
  },

  // Selected / Up Next
  selectedPanel: {
    background: COLORS.bgPanel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "28px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    flexWrap: "wrap",
  },
  selectedTop: {
    flex: "1 1 280px",
    minWidth: 0,
  },
  selectedRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "16px",
    flexWrap: "wrap",
  },
  selectedBadge: {
    background: COLORS.tealDim,
    color: COLORS.teal,
    fontWeight: 700,
    fontSize: "15px",
    letterSpacing: "0.04em",
    padding: "6px 14px",
    borderRadius: "999px",
    border: `1px solid ${COLORS.teal}55`,
    whiteSpace: "nowrap",
  },
  selectedName: {
    fontSize: "clamp(24px, 2.6vw, 36px)",
    fontWeight: 700,
    color: COLORS.textPrimary,
  },
  selectedId: {
    fontFamily: FONT_DISPLAY,
    fontSize: "20px",
    color: COLORS.textMuted,
    fontVariantNumeric: "tabular-nums",
  },
  selectedEmptyText: {
    fontSize: "20px",
    color: COLORS.textFaint,
    fontWeight: 500,
  },
  controlRow: {
    display: "flex",
    gap: "12px",
    flexShrink: 0,
  },
  btn: (accent, disabled) => ({
    fontFamily: FONT_BODY,
    fontSize: "17px",
    fontWeight: 700,
    padding: "14px 24px",
    borderRadius: "12px",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? COLORS.bgPanelRaised : accent,
    color: disabled ? COLORS.textFaint : "#14181F",
    opacity: disabled ? 0.6 : 1,
    transition: "transform 0.08s ease, opacity 0.15s ease",
  }),

  // Waiting list
  queuePanel: {
    background: COLORS.bgPanel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "24px 26px",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
  },
  queueHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  queueCount: {
    fontFamily: FONT_DISPLAY,
    fontSize: "20px",
    color: COLORS.textMuted,
    fontVariantNumeric: "tabular-nums",
  },
  queueList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  queueItem: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto auto",
    alignItems: "center",
    gap: "12px",
    padding: "12px 8px",
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: "18px",
  },
  queuePosition: {
    color: COLORS.textFaint,
    fontFamily: FONT_DISPLAY,
    fontVariantNumeric: "tabular-nums",
    fontSize: "15px",
  },
  queueName: {
    color: COLORS.textPrimary,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  queueId: {
    color: COLORS.textMuted,
    fontFamily: FONT_DISPLAY,
    fontSize: "14px",
    fontVariantNumeric: "tabular-nums",
  },
  queueTime: {
    color: COLORS.textFaint,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
  },
  queueEmpty: {
    color: COLORS.textFaint,
    fontSize: "16px",
    padding: "20px 4px",
  },

  // Register form
  registerForm: {
    background: COLORS.bgPanelRaised,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "16px 18px",
  },
  registerLabel: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: COLORS.textFaint,
    marginBottom: "8px",
    textTransform: "uppercase",
  },
  registerRow: {
    display: "flex",
    gap: "8px",
  },
  registerInput: {
    flex: 1,
    minWidth: 0,
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    padding: "10px 12px",
    color: COLORS.textPrimary,
    fontSize: "15px",
    outline: "none",
  },
  registerBtn: {
    background: COLORS.teal,
    color: "#14181F",
    border: "none",
    borderRadius: "8px",
    padding: "10px 18px",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
  },

  // Empty overlay
  emptyOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(20,24,31,0.92)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    borderRadius: "20px",
  },
  emptyOverlayGlyph: {
    fontSize: "40px",
    color: COLORS.textFaint,
  },
  emptyOverlayTitle: {
    fontSize: "28px",
    fontWeight: 700,
    color: COLORS.textPrimary,
  },
  emptyOverlaySub: {
    fontSize: "16px",
    color: COLORS.textMuted,
    maxWidth: "360px",
    textAlign: "center",
  },
};
