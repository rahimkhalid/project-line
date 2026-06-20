import { useState, useRef, useCallback, useEffect } from "react";
import logo from "./assets/Asset 1.png";

// ---------- Global styles ----------
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
    }

    @media (max-width: 1024px) {
      [data-grid="mainGrid"] {
        display: flex !important;
        flex-direction: column !important;
        grid-template-columns: unset !important;
        grid-template-rows: unset !important;
        height: auto !important;
        min-height: auto !important;
      }
      [data-grid="mainGrid"] > div {
        width: 100% !important;
        min-height: 0 !important;
      }
      [data-grid="categoryGrid"] {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ---------- Design tokens ----------
const COLORS = {
  bg: "#F5F1E8",
  bgPanel: "#FBF8F3",
  bgPanelRaised: "#F9F6F1",
  border: "#C4B5A0",
  textPrimary: "#4A3728",
  textMuted: "#8B7355",
  textFaint: "#A89968",
  amber: "#9D8B7E",
  amberDim: "#E8DFD3",
  teal: "#8B7355",
  tealDim: "#F0E8DC",
};

const FONT_DISPLAY =
  '"Bahnschrift", "DIN Alternate", "Arial Narrow Bold", "Helvetica Neue", sans-serif';
const FONT_BODY =
  '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

// ---------- Constants ----------
const CATEGORIES = ["Dhikr Tasbih", "Ginan", "Qasida in Arabic", "Qasida in Farsi", "Translation of Aya", "Qur'anic Aya"];

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

function playNotificationSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;

  // Create three notes for a pleasant chime sound like waiting rooms
  const notes = [523, 659, 784]; // C5, E5, G5 - pleasant chord
  const duration = 0.8;

  notes.forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    // Set frequency
    osc.frequency.setValueAtTime(freq, now + index * 0.05);

    // Smooth fade in and out
    gain.gain.setValueAtTime(0, now + index * 0.05);
    gain.gain.linearRampToValueAtTime(0.25, now + index * 0.05 + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.start(now + index * 0.05);
    osc.stop(now + duration);
  });
}

// ---------- App ----------
export default function App() {
  const [participants, setParticipants] = useState([]);
  const [categoryStates, setCategoryStates] = useState(
    CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: { current: null, selected: null } }), {})
  );

  const API_URL = process.env.REACT_APP_API_URL || '/api/participants';

  // Fetch participants from API
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data);
      }
    } catch (err) {
      console.error('Failed to fetch participants:', err);
    }
  }, [API_URL]);

  // Poll for updates every 2 seconds
  useEffect(() => {
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 2000);
    return () => clearInterval(interval);
  }, [fetchParticipants]);

  const resetAll = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all participants? This cannot be undone.')) {
      try {
        const res = await fetch(API_URL, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'ALL' }),
        });
        if (res.ok) {
          fetchParticipants();
        }
      } catch (err) {
        console.error('Failed to reset:', err);
      }
    }
  }, [API_URL, fetchParticipants]);

  const registerParticipant = useCallback(async (name, idNumber, category) => {
    const trimmed = name.trim();
    const idTrimmed = idNumber.trim();
    const catTrimmed = category.trim();
    if (!trimmed || !idTrimmed || !catTrimmed) return;

    const newParticipant = {
      id: makeId(),
      name: trimmed,
      idNumber: idTrimmed,
      category: catTrimmed,
      status: "waiting",
      registeredAt: Date.now(),
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newParticipant),
      });
      if (res.ok) {
        fetchParticipants();
      }
    } catch (err) {
      console.error('Failed to register participant:', err);
    }
  }, [API_URL, fetchParticipants]);

  const selectNext = useCallback(async (category) => {
    const categoryParticipants = participants.filter((p) => p.category === category);
    if (categoryStates[category].selected) return;

    const front = categoryParticipants
      .filter((p) => p.status === "waiting")
      .sort((a, b) => a.registeredAt - b.registeredAt)[0];
    if (!front) return;

    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: front.id, status: 'selected' }),
      });
      if (res.ok) {
        fetchParticipants();
      }
    } catch (err) {
      console.error('Failed to select next:', err);
    }
  }, [participants, categoryStates, API_URL, fetchParticipants]);

  const callNext = useCallback(async (category) => {
    let working = participants;
    const hasSelected = working.some((p) => p.status === "selected" && p.category === category);

    // Auto-select front of queue if nobody is selected yet for this category
    let targetId = null;
    if (!hasSelected) {
      const front = working
        .filter((p) => p.category === category && p.status === "waiting")
        .sort((a, b) => a.registeredAt - b.registeredAt)[0];
      if (!front) return;
      targetId = front.id;

      // First set to selected
      try {
        await fetch(API_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId, status: 'selected' }),
        });
      } catch (err) {
        console.error('Failed to select:', err);
        return;
      }
    } else {
      // Get the currently selected participant
      targetId = working.find((p) => p.status === "selected" && p.category === category)?.id;
    }

    // Mark current as served, set selected to current
    const current = working.find((p) => p.category === category && p.status === "current");
    if (current) {
      try {
        await fetch(API_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: current.id, status: 'served' }),
        });
      } catch (err) {
        console.error('Failed to mark as served:', err);
      }
    }

    // Set target to current
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId, status: 'current' }),
      });
      if (res.ok) {
        playNotificationSound();
        fetchParticipants();
      }
    } catch (err) {
      console.error('Failed to call next:', err);
    }
  }, [participants, API_URL, fetchParticipants]);

  // Update categoryStates whenever participants change
  useEffect(() => {
    setCategoryStates((prev) => {
      const updated = { ...prev };
      CATEGORIES.forEach((cat) => {
        updated[cat].current = participants.find((p) => p.category === cat && p.status === "current") || null;
        updated[cat].selected = participants.find((p) => p.category === cat && p.status === "selected") || null;
      });
      return updated;
    });
  }, [participants]);

  const waitingByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = participants.filter((p) => p.category === cat && p.status === "waiting");
    return acc;
  }, {});

  const allActive = participants.filter((p) => p.status !== "served");

  return (
    <div style={styles.app}>
      <div style={styles.appHeading}>Wara Audition</div>
      <div style={styles.mainGrid} data-grid="mainGrid">
        {/* Categories Grid */}
        <div style={styles.categoryGridContainer}>
          <div style={styles.categoryGrid} data-grid="categoryGrid">
            {CATEGORIES.map((category) => (
              <CategoryScreen
                key={category}
                category={category}
                current={categoryStates[category].current}
                selected={categoryStates[category].selected}
                waitingCount={waitingByCategory[category].length}
                onSelectNext={() => selectNext(category)}
                onCall={() => callNext(category)}
                canSelect={!categoryStates[category].selected && waitingByCategory[category].length > 0}
                canCall={Boolean(categoryStates[category].selected) || waitingByCategory[category].length > 0}
              />
            ))}
          </div>
        </div>

        {/* Bottom Control Panel */}
        <div style={styles.controlPanel}>
          <div style={styles.controlContent}>
            <ParticipantsList allActive={allActive} />
            <div style={styles.controlRight}>
              <RegisterForm onRegister={registerParticipant} />
              <button onClick={resetAll} style={styles.resetButton}>
                Reset All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Category Screen Component ----------
function CategoryScreen({
  category,
  current,
  selected,
  waitingCount,
  onSelectNext,
  onCall,
  canSelect,
  canCall,
}) {
  return (
    <section style={styles.categoryScreen}>
      <img src={logo} alt="Logo" style={styles.categoryScreenLogo} />
      <div style={styles.categoryScreenHeader}>
        <div style={styles.categoryTitle}>{category}</div>
        <div style={styles.categoryBadge}>{waitingCount} waiting</div>
      </div>

      <div style={styles.categoryScreenContent}>
        {current ? (
          <div style={styles.categoryDisplay}>
            <img src={logo} alt="Logo" style={styles.categoryLogo} />
            <div style={styles.categoryDisplayId}>{current.idNumber}</div>
            <div style={styles.categoryDisplayName}>{current.name}</div>
          </div>
        ) : (
          <div style={styles.categoryDisplayEmpty}>
            <div style={styles.categoryDisplayEmptyText}>Ready</div>
          </div>
        )}
      </div>

      <div style={styles.categoryControls}>
        <button
          onClick={onSelectNext}
          disabled={!canSelect}
          style={styles.categoryBtn(COLORS.teal, !canSelect)}
        >
          Select
        </button>
        <button
          onClick={onCall}
          disabled={!canCall}
          style={styles.categoryBtn(COLORS.amber, !canCall)}
        >
          Call
        </button>
      </div>

      {selected && (
        <div style={styles.categoryNext}>
          <div style={styles.categoryNextLabel}>Next:</div>
          <div style={styles.categoryNextName}>{selected.name}</div>
        </div>
      )}
    </section>
  );
}

// ---------- Participants List ----------
function ParticipantsList({ allActive }) {
  return (
    <section style={styles.participantsPanel}>
      <div style={styles.participantsHeader}>
        <div style={styles.eyebrow(COLORS.textMuted)}>ALL PARTICIPANTS</div>
        <div style={styles.participantsCount}>{allActive.length}</div>
      </div>

      {allActive.length === 0 ? (
        <div style={styles.participantsEmpty}>No active participants</div>
      ) : (
        <div style={styles.participantsList}>
          {allActive.map((p) => (
            <div key={p.id} style={styles.participantItem(p.status)}>
              <div style={styles.participantItemTop}>
                <div style={styles.participantName}>{p.name}</div>
                <div style={styles.participantCategory}>{p.category}</div>
              </div>
              <div style={styles.participantId}>{p.idNumber}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Registration Form ----------
function RegisterForm({ onRegister }) {
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const nameInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegister(name, idNumber, category);
    setName("");
    setIdNumber("");
    nameInputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} style={styles.registerForm}>
      <div style={styles.registerLabel}>Check in</div>
      <div style={styles.registerRow}>
        <input
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={styles.registerInput}
          autoComplete="off"
        />
        <input
          type="text"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder="ID"
          style={styles.registerInput}
          autoComplete="off"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={styles.registerInput}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <button
          type="submit"
          style={styles.registerBtn}
          disabled={!name.trim() || !idNumber.trim()}
        >
          Add
        </button>
      </div>
    </form>
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
    padding: "16px 16px 16px 8px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  },

  appHeading: {
    fontSize: "32px",
    fontWeight: 700,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: "16px",
    fontFamily: FONT_DISPLAY,
  },

  mainGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    flex: 1,
    minHeight: 0,
  },

  categoryGridContainer: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },

  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    height: "100%",
  },

  categoryScreen: {
    background: COLORS.bgPanel,
    border: `3px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    alignItems: "center",
  },

  categoryScreenLogo: {
    width: "60px",
    height: "60px",
    objectFit: "contain",
    marginBottom: "8px",
  },

  categoryScreenHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingBottom: "8px",
    borderBottom: `1px solid ${COLORS.border}`,
    width: "100%",
  },

  categoryTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: COLORS.textPrimary,
    letterSpacing: "0.05em",
    textAlign: "center",
  },

  categoryBadge: {
    fontSize: "11px",
    color: COLORS.textFaint,
    backgroundColor: COLORS.amberDim,
    padding: "4px 10px",
    borderRadius: "12px",
  },

  categoryScreenContent: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "120px",
  },

  categoryDisplay: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },

  categoryLogo: {
    width: "50px",
    height: "50px",
    objectFit: "contain",
  },

  categoryDisplayId: {
    fontSize: "28px",
    fontFamily: FONT_DISPLAY,
    fontWeight: 700,
    color: COLORS.amber,
  },

  categoryDisplayName: {
    fontSize: "16px",
    fontWeight: 600,
    color: COLORS.textPrimary,
    textAlign: "center",
  },

  categoryDisplayEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.textFaint,
    fontSize: "14px",
  },

  categoryDisplayEmptyText: {
    fontSize: "18px",
  },

  categoryControls: {
    display: "flex",
    gap: "8px",
  },

  categoryBtn: (color, disabled) => ({
    flex: 1,
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 700,
    border: "none",
    borderRadius: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? COLORS.border : color,
    color: disabled ? COLORS.textFaint : COLORS.bg,
    opacity: disabled ? 0.6 : 1,
  }),

  categoryNext: {
    background: COLORS.tealDim,
    border: `1px solid ${COLORS.teal}`,
    borderRadius: "8px",
    padding: "8px",
    fontSize: "12px",
  },

  categoryNextLabel: {
    color: COLORS.textMuted,
    fontWeight: 700,
    marginBottom: "4px",
  },

  categoryNextName: {
    color: COLORS.textPrimary,
    fontWeight: 600,
    fontSize: "13px",
  },

  // Control Panel
  controlPanel: {
    background: COLORS.bgPanel,
    border: `3px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "16px",
  },

  controlContent: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },

  controlRight: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  resetButton: {
    background: "#D32F2F",
    color: COLORS.bg,
    border: "none",
    borderRadius: "8px",
    padding: "12px 18px",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    fontFamily: FONT_BODY,
    transition: "opacity 0.15s ease",
  },

  participantsPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  participantsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },

  participantsCount: {
    fontFamily: FONT_DISPLAY,
    fontSize: "16px",
    color: COLORS.textMuted,
  },

  participantsList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    maxHeight: "150px",
    overflowY: "auto",
  },

  participantItem: (status) => ({
    background: status === "current" ? COLORS.amberDim : status === "selected" ? COLORS.tealDim : COLORS.bg,
    border: `2px solid ${status === "current" ? COLORS.amber : status === "selected" ? COLORS.teal : COLORS.border}`,
    borderRadius: "8px",
    padding: "8px",
    fontSize: "12px",
  }),

  participantItemTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },

  participantName: {
    fontWeight: 700,
    color: COLORS.textPrimary,
  },

  participantCategory: {
    fontSize: "11px",
    color: COLORS.textMuted,
    fontWeight: 500,
  },

  participantId: {
    color: COLORS.textMuted,
    fontSize: "11px",
  },

  participantsEmpty: {
    color: COLORS.textFaint,
    fontSize: "13px",
    textAlign: "center",
    padding: "10px",
  },

  // Register Form
  registerForm: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  registerLabel: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: COLORS.textFaint,
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
    fontSize: "13px",
    outline: "none",
    fontFamily: FONT_BODY,
  },

  registerBtn: {
    background: COLORS.teal,
    color: COLORS.bg,
    border: "none",
    borderRadius: "8px",
    padding: "10px 18px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },

  eyebrow: (color) => ({
    fontFamily: FONT_BODY,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    color,
    textTransform: "uppercase",
  }),
};
