"use client";

import { useEffect, useRef, useState } from "react";
import "./globals.css";
import { ensureModel, predictIntent } from "@/lib/nlp";
import { initDb, queryByIntent } from "@/lib/sql";
import mockSamples from "@/data/intents.json";
import seedSQL from "@/data/seed";
import { polishIfEnabled, PolishResult } from "@/lib/respond";

type Msg = { role: "user" | "bot"; text: string };

const FLASH_QUESTIONS = [
  "who is playing today",
  "score berlin united",
  "result for munich city",
  "who scored for berlin united",
  "who scored for munich city",
  "where was the match",
  "which stadium was it played",
  "what sport is this match",
  "next match berlin united",
  "last match hamburg fc",
  "top scorer for munich city",
  "tournament info",
  "help"
];

function smallTalk(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (/^(hi|hello|hey|yo)\b/.test(t)) return "Hey! I’m SportIQ. Ask me about scores, scorers, fixtures, or stadiums.";
  if (/how are (you|u)|how's it going|how r u/.test(t)) return "Doing great, thanks! I can help with sports questions like scores or goal scorers.";
  if (/thank(s| you)|thx|thanks/.test(t)) return "Happy to help.";
  if (/bye|goodbye|see you|cya/.test(t)) return "See you next time.";
  if (/which teams\??$/.test(t)) return "Try naming a team. For example: score Berlin United or who scored for Munich City.";
  return null;
}

function ruleRoute(text: string): string | null {
  const t = text.toLowerCase();
  if (/who.*playing.*today|today.*fixtures|today.*matches/.test(t)) return "today_fixtures";
  if (/\b(score|result)\b/.test(t)) return "latest_score";
  if (/top scorer|leading scorer|highest.*scorer/.test(t)) return "top_scorer_team"; // moved up
  if (/who.*scored|goal.*scorer|scorers?/.test(t)) return "goal_scorers";
  if (/where.*match|which.*stadium|\bstadium\b|\bcity\b/.test(t)) return "stadium_location";
  if (/what.*sport|type of sport|sport type/.test(t)) return "sport_type_for_match";
  if (/next match|upcoming|fixture/.test(t)) return "upcoming_for_team";
  if (/last match|previous game/.test(t)) return "last_match_for_team";
  if (/tournament/.test(t)) return "tournament_info";
  if (/help|what can you do/.test(t)) return "help";
  if (/who.*won|winner/.test(t)) return "tournament_info";
  return null;
}

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Hi 👋 I’m SportIQ. Ask me about fixtures, scores, scorers, stadiums, or sport type." }
  ]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [polish, setPolish] = useState(false);
  const [typing, setTyping] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [flash, setFlash] = useState<string[]>([]);
  const [polishStatus, setPolishStatus] = useState<string>("");

  const dbRef = useRef<any>(null);
  const flashTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      dbRef.current = await initDb(seedSQL);
      await ensureModel(mockSamples);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!flashOn) {
      if (flashTimer.current) clearInterval(flashTimer.current);
      setFlash([]);
      return;
    }
    const shuffle = () => {
      const pool = [...FLASH_QUESTIONS];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setFlash(pool.slice(0, 3));
    };
    shuffle();
    flashTimer.current = setInterval(shuffle, 6000);
    return () => flashTimer.current && clearInterval(flashTimer.current);
  }, [flashOn]);

  async function send() {
    const text = input.trim();
    if (!text || !ready) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setPolishStatus("");

    // small talk first
    const small = smallTalk(text);
    if (small) {
      const polished: PolishResult = await polishIfEnabled(small, polish);
      setPolishStatus(polished.usedModel && polished.usedModel !== "off" ? polished.usedModel : "");
      setMessages(m => [...m, { role: "bot", text: polished.text }]);
      setTyping(false);
      return;
    }

    // rule-first, then ML fallback
    let intent = ruleRoute(text);
    let confidence = 1;

    try {
      if (!intent) {
        const pred = await predictIntent(text);
        intent = pred.intent;
        confidence = pred.confidence;
      }
    } catch {
      setMessages(m => [...m, { role: "bot", text: "I refreshed my brain. Ask that again please." }]);
      setTyping(false);
      return;
    }

    // non-sports fallback
    if (!intent || confidence < 0.45) {
      const polished: PolishResult = await polishIfEnabled(
        "I can help with sports only. Try asking about scores, fixtures, scorers, stadiums, or sport type.",
        polish
      );
      setPolishStatus(polished.usedModel && polished.usedModel !== "off" ? polished.usedModel : "");
      setMessages(m => [...m, { role: "bot", text: polished.text }]);
      setTyping(false);
      return;
    }

    const raw = queryByIntent(dbRef.current!, intent, text);
    const polished: PolishResult = await polishIfEnabled(raw, polish);
    setPolishStatus(polished.usedModel && polished.usedModel !== "off" ? polished.usedModel : "");
    setMessages(m => [...m, { role: "bot", text: polished.text }]);
    setTyping(false);
  }

  return (
    <div className="container">
      <header className="header" style={{ marginBottom: 12 }}>
        <img src="/logo.svg" alt="logo" width={26} height={26} />
        <h1>SportIQ</h1>
        <span className="badge">AI Sports Companion</span>
        <span className="badge">Step 3 NLP++</span>
        {polish && <span className="badge">{polishStatus ? "DeepSeek active" : "Polish on"}</span>}
      </header>

      <div className="card" style={{ minHeight: 340 }}>
        {messages.map((m, i) => (
          <div key={i} className="msg">
            <span className="role">{m.role === "user" ? "You:" : "SportIQ:"}</span>
            <span>{m.text}</span>
          </div>
        ))}
        {typing && (
          <div className="msg">
            <span className="role">SportIQ:</span>
            <span>typing…</span>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="input"
          placeholder="Try: score Berlin United, who scored for Munich City, where was the match"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => (e.key === "Enter" ? send() : undefined)}
          disabled={!ready}
        />
        <button className="btn" onClick={send} disabled={!ready}>
          Send
        </button>
      </div>

      <div className="row" style={{ marginTop: 8, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={polish} onChange={e => setPolish(e.target.checked)} />
          <span className="badge">Polish replies with OpenRouter</span>
        </label>
        <button className="btn" onClick={() => setFlashOn(v => !v)}>{flashOn ? "Stop Flashcards" : "Start Flashcards"}</button>
      </div>

      {!!flash.length && (
        <div className="row" style={{ marginTop: 10 }}>
          {flash.map((q, i) => (
            <div
              key={i}
              className="badge"
              style={{ padding: "6px 10px", cursor: "pointer" }}
              onClick={() => setInput(q)}
              title="Click to fill the input"
            >
              {q}
            </div>
          ))}
        </div>
      )}

      <div className="footer">© 2025 SportIQ</div>
    </div>
  );
}
