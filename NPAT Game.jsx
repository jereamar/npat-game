import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const CATEGORIES = ["Name", "Place", "Animal", "Thing"];
const LETTERS = "ABCDEFGHIJKLMNOPRSTW".split("");
const ROUND_TIME = 30;
const TOTAL_ROUNDS = 3;
const POLL_MS = 1500;

const C = {
  bg: "#0a0a0f",
  surface: "#13121a",
  card: "#1c1b26",
  cardHover: "#22202e",
  border: "#2a2838",
  accent: "#f97316",
  accentDim: "#f9731622",
  accentGlow: "#f9731644",
  gold: "#fbbf24",
  purple: "#8b5cf6",
  green: "#10b981",
  red: "#f43f5e",
  blue: "#38bdf8",
  text: "#f1f0f9",
  muted: "#6b6882",
  sub: "#9895b0",
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}
function pickLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}
function avatarColor(name) {
  const colors = [C.accent, C.purple, C.green, C.blue, C.gold, "#ec4899"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}
function Avatar({ name, size = 36 }) {
  const bg = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif", fontWeight: 700,
      fontSize: size * 0.38, color: "#fff", flexShrink: 0,
      textTransform: "uppercase", letterSpacing: "-0.5px"
    }}>{name.slice(0, 2)}</div>
  );
}

/* ─────────────────────────────────────────────
   STORAGE HELPERS  (shared = true → all players see it)
───────────────────────────────────────────── */
async function sGet(key) {
  try { const r = await window.storage.get(key, true); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function sSet(key, val) {
  try { await window.storage.set(key, JSON.stringify(val), true); } catch { }
}
async function sDel(key) {
  try { await window.storage.delete(key, true); } catch { }
}

/* ─────────────────────────────────────────────
   AI JUDGE
───────────────────────────────────────────── */
async function judgeAnswers(letter, playerAnswersList) {
  const formatted = playerAnswersList.map(p =>
    `${p.name}: Name="${p.answers.Name}", Place="${p.answers.Place}", Animal="${p.answers.Animal}", Thing="${p.answers.Thing}"`
  ).join("\n");

  const prompt = `You are judging a "Name, Place, Animal, Thing" game. Letter: "${letter}"

Players:
${formatted}

Rules:
- 10pts: valid answer starting with "${letter}"
- 5pts: valid but very common/generic
- 0pts: empty, wrong letter, or not a real word for that category
- BONUS: if two or more players wrote the exact same answer (case-insensitive), everyone who wrote it gets only 5pts instead of 10pts (it's a "clash")

Respond ONLY in JSON (no markdown):
{
  "players": [
    {
      "name": "PlayerName",
      "scores": { "Name": 0-10, "Place": 0-10, "Animal": 0-10, "Thing": 0-10 },
      "feedback": { "Name": "reason", "Place": "reason", "Animal": "reason", "Thing": "reason" },
      "valid": { "Name": true/false, "Place": true/false, "Animal": true/false, "Thing": true/false },
      "total": number
    }
  ],
  "clashes": ["Animal"] 
}
"clashes" = categories where 2+ players had the same answer.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    // fallback
    const players = playerAnswersList.map(p => {
      let total = 0;
      const scores = {}; const feedback = {}; const valid = {};
      CATEGORIES.forEach(cat => {
        const ans = p.answers[cat]?.trim() || "";
        const ok = ans.length > 0 && ans[0].toUpperCase() === letter;
        scores[cat] = ok ? 10 : 0; feedback[cat] = ok ? "✓" : "✗"; valid[cat] = ok;
        total += scores[cat];
      });
      return { name: p.name, scores, feedback, valid, total };
    });
    return { players, clashes: [] };
  }
}

/* ─────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────── */
function GlobalStyles() {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      input:focus{outline:none}
      input::placeholder{color:#3d3b52}
      ::-webkit-scrollbar{width:4px}
      ::-webkit-scrollbar-thumb{background:#2a2838;border-radius:2px}
      @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
      @keyframes popIn{from{opacity:0;transform:scale(0.5) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
      @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
      @keyframes revealCard{from{opacity:0;transform:translateY(24px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes countPop{0%{transform:scale(1)}50%{transform:scale(1.35)}100%{transform:scale(1)}}
      .btn-primary{transition:transform .15s,box-shadow .15s}
      .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 28px ${C.accentGlow}}
      .btn-primary:active{transform:translateY(0)}
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);
  return null;
}

/* ─────────────────────────────────────────────
   TIMER RING
───────────────────────────────────────────── */
function TimerRing({ seconds, total, large }) {
  const size = large ? 120 : 64;
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const pct = seconds / total;
  const color = pct > 0.5 ? C.green : pct > 0.25 ? C.gold : C.red;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset .9s linear,stroke .4s" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Syne', sans-serif", fontWeight: 800,
        fontSize: large ? 36 : 18, color,
        animation: seconds <= 5 ? "countPop .9s infinite" : "none"
      }}>{seconds}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LOADING SPINNER
───────────────────────────────────────────── */
function Spinner() {
  return <div style={{
    width: 22, height: 22, borderRadius: "50%",
    border: `3px solid ${C.border}`, borderTopColor: C.accent,
    animation: "spin .7s linear infinite", display: "inline-block"
  }} />;
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function NPATMultiplayer() {
  const [screen, setScreen] = useState("home");
  const [myName, setMyName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [answers, setAnswers] = useState({ Name: "", Place: "", Animal: "", Thing: "" });
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [judging, setJudging] = useState(false);
  const [error, setError] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [tabSwitches, setTabSwitches] = useState(0);
  const [cheatWarning, setCheatWarning] = useState(false);
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const lastPhaseRef = useRef(null);
  const inputRefs = useRef([]);
  const tabSwitchesRef = useRef(0);
  const isPlayingRef = useRef(false);
  const submittedRef = useRef(false);

  /* ── inject global CSS ── */
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Instrument+Sans:wght@400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      input:focus{outline:none}
      input::placeholder{color:#3d3b52}
      ::-webkit-scrollbar{width:4px}
      ::-webkit-scrollbar-thumb{background:#2a2838;border-radius:2px}
      @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
      @keyframes popIn{from{opacity:0;transform:scale(0.5) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
      @keyframes revealCard{from{opacity:0;transform:translateY(24px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes countPop{0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  /* ── polling ── */
  const startPolling = useCallback((code) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const gs = await sGet(`room:${code}`);
      if (!gs) return;
      setGameState(gs);
    }, POLL_MS);
  }, []);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
  }, []);

  /* ── tab-switch detection ── */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlayingRef.current && !submittedRef.current) {
        // increment switch count
        tabSwitchesRef.current += 1;
        setTabSwitches(tabSwitchesRef.current);
        setCheatWarning(true);
        // auto-submit immediately
        autoSubmitOnLeave();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [roomCode, myName]);

  /* ── track playing state for visibility handler ── */
  useEffect(() => {
    isPlayingRef.current = gameState?.phase === "playing";
    if (gameState?.phase !== "playing") {
      submittedRef.current = false;
      setCheatWarning(false);
    }
  }, [gameState?.phase]);

  /* ── react to gameState changes ── */
  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (phase === lastPhaseRef.current) return;
    lastPhaseRef.current = phase;

    if (phase === "playing") {
      setSubmitted(false);
      submittedRef.current = false;
      tabSwitchesRef.current = 0;
      setTabSwitches(0);
      setCheatWarning(false);
      setAnswers({ Name: "", Place: "", Animal: "", Thing: "" });
      setTimeLeft(ROUND_TIME);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    if (phase === "reveal" || phase === "lobby" || phase === "final") {
      clearInterval(timerRef.current);
    }
  }, [gameState?.phase, gameState?.round]);

  /* ── auto-submit when timer hits 0 ── */
  useEffect(() => {
    if (timeLeft === 0 && gameState?.phase === "playing" && !submitted) {
      handleSubmit();
    }
  }, [timeLeft]);

  /* ── host judges when all submitted ── */
  useEffect(() => {
    if (!isHost || !gameState) return;
    if (gameState.phase !== "playing") return;
    const players = gameState.players || [];
    const subs = gameState.submissions || {};
    const allIn = players.every(p => subs[p]);
    if (allIn && players.length > 0) runJudging();
  }, [gameState?.submissions, isHost]);

  /* ─────────────── ACTIONS ─────────────── */

  async function createRoom() {
    if (!nameInput.trim()) { setError("Enter your name"); return; }
    const code = genCode();
    const name = nameInput.trim();
    const gs = {
      code, phase: "lobby", round: 0,
      players: [name], host: name,
      scores: { [name]: 0 },
      submissions: {}, results: null, history: []
    };
    await sSet(`room:${code}`, gs);
    setRoomCode(code);
    setMyName(name);
    setIsHost(true);
    setGameState(gs);
    startPolling(code);
    setScreen("lobby");
  }

  async function joinRoom() {
    if (!nameInput.trim()) { setError("Enter your name"); return; }
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    const code = joinCode.trim().toUpperCase();
    const gs = await sGet(`room:${code}`);
    if (!gs) { setError("Room not found. Check the code!"); return; }
    if (gs.phase !== "lobby") { setError("Game already started!"); return; }
    const name = nameInput.trim();
    if (gs.players.includes(name)) { setError("Name already taken in this room!"); return; }
    const updated = {
      ...gs,
      players: [...gs.players, name],
      scores: { ...gs.scores, [name]: 0 }
    };
    await sSet(`room:${code}`, updated);
    setRoomCode(code);
    setMyName(name);
    setIsHost(false);
    setGameState(updated);
    startPolling(code);
    setScreen("lobby");
  }

  async function startGame() {
    const gs = await sGet(`room:${roomCode}`);
    const letter = pickLetter();
    const updated = {
      ...gs,
      phase: "playing",
      round: 1,
      letter,
      submissions: {},
      results: null,
      roundStartTime: Date.now()
    };
    await sSet(`room:${roomCode}`, updated);
    setGameState(updated);
  }

  async function autoSubmitOnLeave() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    // save cheat flag alongside answers
    const currentAnswers = { Name: "", Place: "", Animal: "", Thing: "" };
    setAnswers(a => { Object.assign(currentAnswers, a); return a; });
    // small delay to capture current answers state
    setTimeout(async () => {
      const gs = await sGet(`room:${roomCode}`);
      if (!gs) return;
      const switches = tabSwitchesRef.current;
      const updated = {
        ...gs,
        submissions: { ...gs.submissions, [myName]: currentAnswers },
        cheatFlags: { ...(gs.cheatFlags || {}), [myName]: switches }
      };
      await sSet(`room:${roomCode}`, updated);
      setGameState(updated);
    }, 80);
  }

  async function handleSubmit() {
    if (submitted || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    const gs = await sGet(`room:${roomCode}`);
    const switches = tabSwitchesRef.current;
    const updated = {
      ...gs,
      submissions: { ...gs.submissions, [myName]: answers },
      cheatFlags: { ...(gs.cheatFlags || {}), [myName]: switches }
    };
    await sSet(`room:${roomCode}`, updated);
    setGameState(updated);
  }

  async function runJudging() {
    if (judging) return;
    setJudging(true);
    const gs = await sGet(`room:${roomCode}`);
    if (!gs || gs.phase !== "playing") { setJudging(false); return; }

    const playerAnswersList = gs.players.map(p => ({
      name: p,
      answers: gs.submissions[p] || { Name: "", Place: "", Animal: "", Thing: "" }
    }));

    const judgment = await judgeAnswers(gs.letter, playerAnswersList);

    // update cumulative scores
    const newScores = { ...gs.scores };
    judgment.players.forEach(p => {
      newScores[p.name] = (newScores[p.name] || 0) + p.total;
    });

    const isLastRound = gs.round >= TOTAL_ROUNDS;
    const updated = {
      ...gs,
      phase: isLastRound ? "final" : "reveal",
      results: judgment,
      scores: newScores,
      history: [...(gs.history || []), { round: gs.round, letter: gs.letter, judgment }]
    };
    await sSet(`room:${roomCode}`, updated);
    setGameState(updated);
    setJudging(false);
  }

  async function nextRound() {
    const gs = await sGet(`room:${roomCode}`);
    const letter = pickLetter();
    const updated = {
      ...gs,
      phase: "playing",
      round: gs.round + 1,
      letter,
      submissions: {},
      results: null,
      roundStartTime: Date.now()
    };
    await sSet(`room:${roomCode}`, updated);
    setGameState(updated);
  }

  async function resetGame() {
    await sDel(`room:${roomCode}`);
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setScreen("home");
    setGameState(null);
    setRoomCode("");
    setMyName("");
    setIsHost(false);
  }

  /* ─────────────── STYLES ─────────────── */
  const wrap = {
    minHeight: "100vh", background: C.bg, color: C.text,
    fontFamily: "'Instrument Sans', sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "20px",
    backgroundImage: `radial-gradient(ellipse 60% 40% at 15% 15%,#1a0f2e,transparent),
                      radial-gradient(ellipse 50% 50% at 85% 85%,#0f1a20,transparent)`
  };

  const card = {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: "18px", padding: "28px"
  };

  const inputStyle = {
    width: "100%", background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: "12px", padding: "13px 16px", color: C.text,
    fontSize: "15px", fontFamily: "'Instrument Sans', sans-serif",
    marginTop: "8px"
  };

  const btnPrimary = {
    width: "100%", padding: "15px", borderRadius: "12px",
    border: "none", background: C.accent, color: "#fff",
    fontFamily: "'Syne', sans-serif", fontWeight: 700,
    fontSize: "15px", cursor: "pointer", letterSpacing: "0.3px",
    boxShadow: `0 4px 20px ${C.accentGlow}`,
    transition: "transform .15s, box-shadow .15s"
  };

  const btnSecondary = {
    width: "100%", padding: "13px", borderRadius: "12px",
    border: `1px solid ${C.border}`, background: "transparent",
    color: C.sub, fontFamily: "'Instrument Sans', sans-serif",
    fontSize: "14px", cursor: "pointer"
  };

  const label = {
    fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase",
    color: C.muted, fontWeight: "600"
  };

  /* ═══════════════════════════════════════
     SCREENS
  ═══════════════════════════════════════ */

  /* ── HOME ── */
  if (screen === "home") return (
    <div style={wrap}>
      <div style={{ maxWidth: 420, width: "100%", animation: "fadeUp .5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "4px", color: C.accent, textTransform: "uppercase", marginBottom: "14px" }}>
            Multiplayer Word Game
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(44px,11vw,72px)", lineHeight: 0.95, marginBottom: "16px" }}>
            Name<span style={{ color: C.accent }}>.</span><br />
            Place<span style={{ color: C.purple }}>.</span><br />
            Animal<span style={{ color: C.green }}>.</span><br />
            Thing<span style={{ color: C.gold }}>.</span>
          </h1>
          <p style={{ color: C.muted, fontSize: "14px", lineHeight: 1.6 }}>
            Real-time multiplayer · AI judging · See everyone's answers
          </p>
          <div style={{ marginTop: "16px", fontSize: "12px", color: C.muted, letterSpacing: "0.5px" }}>
            Built by <span style={{ color: C.accent, fontWeight: 600 }}>Amar Jere</span>
          </div>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div style={label}>Your Name</div>
          <input value={nameInput} onChange={e => { setNameInput(e.target.value); setError(""); }}
            placeholder="Enter your name..." style={inputStyle}
            onKeyDown={e => e.key === "Enter" && nameInput && createRoom()} />
        </div>

        {error && <div style={{ color: C.red, fontSize: "13px", marginBottom: "10px", textAlign: "center" }}>{error}</div>}

        <button onClick={createRoom} style={{ ...btnPrimary, marginBottom: "10px" }}
          onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = `0 10px 30px ${C.accentGlow}`; }}
          onMouseLeave={e => { e.target.style.transform = ""; e.target.style.boxShadow = `0 4px 20px ${C.accentGlow}`; }}>
          🎮 Create Room
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ color: C.muted, fontSize: "13px" }}>or join</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <input value={joinCode} onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
            placeholder="Room code..." maxLength={4}
            style={{ ...inputStyle, marginTop: 0, flex: 1, textTransform: "uppercase", fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: "4px", fontSize: "18px", textAlign: "center" }} />
          <button onClick={joinRoom} style={{
            padding: "13px 20px", borderRadius: "12px", border: `1px solid ${C.accent}`,
            background: C.accentDim, color: C.accent, fontFamily: "'Syne', sans-serif",
            fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap"
          }}>Join →</button>
        </div>
      </div>
    </div>
  );

  /* ── LOBBY ── */
  if (screen === "lobby") {
    const gs = gameState;
    const players = gs?.players || [];
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 440, width: "100%", animation: "fadeUp .5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={label}>Room Code</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 800,
              fontSize: "56px", letterSpacing: "8px", color: C.accent,
              textShadow: `0 0 40px ${C.accentGlow}`
            }}>{roomCode}</div>
            <p style={{ color: C.muted, fontSize: "13px", marginTop: "6px" }}>
              Share this code with friends to join
            </p>
          </div>

          <div style={{ ...card, marginBottom: "16px" }}>
            <div style={{ ...label, marginBottom: "14px" }}>Players ({players.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {players.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", animation: `fadeUp .3s ${i * .08}s both` }}>
                  <Avatar name={p} />
                  <span style={{ fontWeight: 500 }}>{p}</span>
                  {p === gs.host && <span style={{ marginLeft: "auto", fontSize: "11px", color: C.gold, letterSpacing: "1px", textTransform: "uppercase" }}>host</span>}
                  {p === myName && <span style={{ marginLeft: p !== gs.host ? "auto" : "8px", fontSize: "11px", color: C.muted }}>you</span>}
                </div>
              ))}
              {players.length < 2 && (
                <div style={{ color: C.muted, fontSize: "13px", fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
                  Waiting for more players…
                </div>
              )}
            </div>
          </div>

          <div style={{ ...card, marginBottom: "16px", background: C.surface }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: "13px" }}>
              <span>⏱ {ROUND_TIME}s per round</span>
              <span>🔄 {TOTAL_ROUNDS} rounds</span>
              <span>🤖 AI judging</span>
            </div>
          </div>

          {isHost ? (
            <button onClick={startGame}
              disabled={players.length < 1}
              style={{ ...btnPrimary, opacity: players.length < 1 ? 0.5 : 1 }}
              onMouseEnter={e => { if (players.length >= 1) e.target.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.target.style.transform = ""; }}>
              {players.length < 2 ? "Start Solo (or wait for friends)" : "Start Game →"}
            </button>
          ) : (
            <div style={{ textAlign: "center", color: C.muted, fontSize: "14px", padding: "16px", animation: "pulse 2s infinite" }}>
              Waiting for host to start…
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: "20px", fontSize: "11px", color: C.muted }}>
            Built by <span style={{ color: C.accent, fontWeight: 600 }}>Amar Jere</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── PLAYING ── */
  if (screen === "lobby" || (gameState?.phase === "playing" && screen === "lobby")) { }
  if (gameState?.phase === "playing") {
    const gs = gameState;
    const waitingFor = gs.players.filter(p => !gs.submissions?.[p]);
    const mySubmitted = !!gs.submissions?.[myName] || submitted;

    return (
      <div style={wrap}>
        <div style={{ maxWidth: 500, width: "100%", animation: "fadeUp .4s ease" }}>
          {/* top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <div style={label}>Round {gs.round}/{TOTAL_ROUNDS}</div>
              <div style={{ fontSize: "13px", color: C.muted, marginTop: "2px" }}>
                {mySubmitted ? `Waiting for ${waitingFor.length} player(s)…` : `${gs.players.length} players`}
              </div>
            </div>
            <TimerRing seconds={timeLeft} total={ROUND_TIME} />
          </div>

          {/* letter */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 800,
              fontSize: "clamp(72px,18vw,110px)", lineHeight: 1, color: C.accent,
              textShadow: `0 0 60px ${C.accentGlow}, 0 0 120px ${C.accentDim}`,
              animation: "popIn .4s cubic-bezier(.34,1.56,.64,1)"
            }}>{gs.letter}</div>
            <div style={{ color: C.muted, fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", marginTop: "4px" }}>
              this round's letter
            </div>
          </div>

          {/* cheat warning banner */}
          {cheatWarning && (
            <div style={{
              background: `${C.red}18`, border: `1px solid ${C.red}55`,
              borderRadius: "12px", padding: "12px 16px", marginBottom: "14px",
              display: "flex", alignItems: "center", gap: "10px",
              animation: "fadeUp .3s ease"
            }}>
              <span style={{ fontSize: "20px" }}>🚨</span>
              <div>
                <div style={{ color: C.red, fontWeight: 600, fontSize: "14px" }}>Tab switch detected!</div>
                <div style={{ color: C.muted, fontSize: "12px", marginTop: "2px" }}>
                  Your answers were auto-submitted and a cheat flag was recorded ({tabSwitches}×).
                </div>
              </div>
            </div>
          )}

          {mySubmitted ? (
            /* waiting screen */
            <div style={{ ...card, textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px", marginBottom: "8px" }}>
                Answers submitted!
              </div>
              <div style={{ color: C.muted, fontSize: "14px", marginBottom: "20px" }}>
                Waiting for others…
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                {gs.players.map(p => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", background: gs.submissions?.[p] ? `${C.green}22` : C.surface, border: `1px solid ${gs.submissions?.[p] ? C.green + "44" : C.border}` }}>
                    <Avatar name={p} size={20} />
                    <span style={{ fontSize: "13px", color: gs.submissions?.[p] ? C.green : C.muted }}>{p}</span>
                    {gs.submissions?.[p] ? <span style={{ fontSize: "10px" }}>✓</span> : <span style={{ animation: "pulse 1.5s infinite", fontSize: "10px" }}>…</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* answer form */
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                {CATEGORIES.map((cat, i) => {
                  const catColors = [C.accent, C.purple, C.green, C.gold];
                  return (
                    <div key={cat} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      background: C.card, borderRadius: "14px",
                      padding: "4px 16px 4px 4px",
                      border: `1px solid ${answers[cat] ? catColors[i] + "44" : C.border}`,
                      animation: `fadeUp .35s ${i * .07}s both`,
                      transition: "border-color .2s"
                    }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: "12px",
                        background: catColors[i] + "18",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: catColors[i], fontSize: "10px", letterSpacing: "1px",
                        textTransform: "uppercase", fontWeight: 600, flexShrink: 0, textAlign: "center"
                      }}>{cat}</div>
                      <input
                        ref={el => inputRefs.current[i] = el}
                        value={answers[cat]}
                        onChange={e => setAnswers(a => ({ ...a, [cat]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") i < 3 ? inputRefs.current[i + 1]?.focus() : handleSubmit(); }}
                        placeholder={`${cat} with "${gs.letter}"…`}
                        style={{ flex: 1, background: "transparent", border: "none", color: C.text, fontSize: "16px", fontFamily: "'Instrument Sans', sans-serif", padding: "12px 0" }}
                        autoFocus={i === 0}
                        disabled={mySubmitted}
                      />
                    </div>
                  );
                })}
              </div>
              <button onClick={handleSubmit} style={btnPrimary}
                onMouseEnter={e => { e.target.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.target.style.transform = ""; }}>
                ✋ STOP — Submit Answers
              </button>
            </>
          )}

          {/* host judging indicator */}
          {isHost && judging && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginTop: "16px", color: C.muted, fontSize: "13px" }}>
              <Spinner /> AI is judging answers…
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── REVEAL ── */
  if (gameState?.phase === "reveal" || gameState?.phase === "final") {
    const gs = gameState;
    const judgment = gs.results;
    const isFinal = gs.phase === "final";

    // sort players by round score
    const roundScores = {};
    judgment?.players?.forEach(p => { roundScores[p.name] = p.total; });

    const sortedPlayers = [...(gs.players || [])].sort((a, b) => (roundScores[b] || 0) - (roundScores[a] || 0));

    return (
      <div style={{ ...wrap, justifyContent: "flex-start", paddingTop: "24px" }}>
        <div style={{ maxWidth: 600, width: "100%", animation: "fadeUp .4s ease" }}>

          {/* header */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={label}>Round {gs.round} · Letter</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "64px", color: C.accent, lineHeight: 1 }}>{gs.letter}</div>
          </div>

          {/* category columns */}
          {CATEGORIES.map((cat, ci) => {
            const catColors = [C.accent, C.purple, C.green, C.gold];
            const col = catColors[ci];
            const isClash = judgment?.clashes?.includes(cat);
            return (
              <div key={cat} style={{
                ...card, marginBottom: "12px",
                border: `1px solid ${col}33`,
                animation: `revealCard .4s ${ci * .1}s both`
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: col, fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase" }}>
                    {cat}
                  </div>
                  {isClash && <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: C.gold + "22", color: C.gold, letterSpacing: "1px" }}>⚠ CLASH — 5pts</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {gs.players.map((pname, pi) => {
                    const pdata = judgment?.players?.find(p => p.name === pname);
                    const ans = gs.submissions?.[pname]?.[cat] || "";
                    const pts = pdata?.scores?.[cat] ?? 0;
                    const valid = pdata?.valid?.[cat];
                    const reason = pdata?.feedback?.[cat] || "";
                    const switches = gs.cheatFlags?.[pname] || 0;
                    return (
                      <div key={pi} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 12px", borderRadius: "10px",
                        background: switches > 0 ? `${C.red}0d` : valid ? `${col}0e` : `${C.red}0a`,
                        border: `1px solid ${switches > 0 ? C.red + "33" : valid ? col + "25" : C.red + "20"}`,
                        animation: `fadeUp .3s ${ci * .1 + pi * .06}s both`
                      }}>
                        <Avatar name={pname} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 500, fontSize: "15px", color: valid ? C.text : C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {ans || <em style={{ color: C.red + "88", fontSize: "13px" }}>no answer</em>}
                            </span>
                            {switches > 0 && (
                              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "10px", background: C.red + "22", color: C.red, whiteSpace: "nowrap", flexShrink: 0 }}>
                                🚨 {switches}× tab switch
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>{reason}</div>
                        </div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "22px", color: pts >= 10 ? C.green : pts === 5 ? C.gold : C.red }}>
                          +{pts}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* scoreboard */}
          <div style={{ ...card, marginBottom: "16px", animation: `revealCard .4s .45s both` }}>
            <div style={{ ...label, marginBottom: "14px" }}>{isFinal ? "🏆 Final Scores" : "Standings"}</div>
            {[...gs.players]
              .sort((a, b) => (gs.scores[b] || 0) - (gs.scores[a] || 0))
              .map((p, i) => {
                const switches = gs.cheatFlags?.[p] || 0;
                return (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: i < gs.players.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px", width: "28px", color: i === 0 ? C.gold : C.muted }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                  </div>
                  <Avatar name={p} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      {p}
                      {p === myName && <span style={{ color: C.muted, fontSize: "12px" }}>(you)</span>}
                      {switches > 0 && (
                        <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", background: C.red + "22", color: C.red }}>
                          🚨 {switches}× tab switch
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: C.green }}>+{roundScores[p] || 0} this round</div>
                  </div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "28px", color: i === 0 ? C.gold : C.text }}>
                    {gs.scores[p] || 0}
                  </div>
                </div>
              );}
              )}
          </div>

          {isFinal ? (
            <div style={{ display: "flex", gap: "10px", animation: `fadeUp .3s .5s both` }}>
              {isHost && <button onClick={resetGame} style={btnPrimary}>🔄 Play Again</button>}
              {!isHost && <div style={{ ...btnSecondary, textAlign: "center", padding: "15px" }}>Game over! Host can restart.</div>}
            </div>
          ) : isHost ? (
            <button onClick={nextRound} style={{ ...btnPrimary, animation: `fadeUp .3s .5s both` }}>
              Next Round ({gs.round + 1}/{TOTAL_ROUNDS}) →
            </button>
          ) : (
            <div style={{ textAlign: "center", color: C.muted, fontSize: "14px", padding: "16px", animation: "pulse 2s infinite" }}>
              Waiting for host to start next round…
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: "20px", fontSize: "11px", color: C.muted }}>
            Built by <span style={{ color: C.accent, fontWeight: 600 }}>Amar Jere</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── fallback: still in lobby screen after game started ── */
  if (gameState && gameState.phase !== "lobby") {
    return (
      <div style={wrap}>
        <div style={{ textAlign: "center" }}>
          <Spinner />
          <div style={{ color: C.muted, marginTop: "12px" }}>Loading game…</div>
        </div>
      </div>
    );
  }

  return null;
}