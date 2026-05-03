"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEvent, usePlayerProgress } from "../hooks/useEvent";
import { findPlayer } from "../lib/playerRoster";
import { QuizScreen } from "./QuizScreen";
import { BeastsBattle } from "./BeastsBattle";
import { HoOhBattle } from "./HoOhBattle";
import type { Player } from "../lib/playerRoster";

/* ═══════════════════════════════════════════════
   BOSS EVENT FLOW — Fully automated per-player
   Admin just starts the event. Each player advances
   independently based on their own Firestore progress.

   Flow: lobby → quiz → beasts → ho-oh → result

   Routing: driven by usePlayerProgress (onSnapshot),
   so as soon as a step is submitted to Firestore the
   player is automatically moved to the next step.
   ═══════════════════════════════════════════════ */

type Step =
  | "loading"
  | "lobby"
  | "not_in_roster"
  | "event_waiting"
  | "quiz"
  | "beasts"
  | "hooh"
  | "done";

export function BossEventFlow() {
  const event = useEvent();

  const [inputValue, setInputValue] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [step, setStep] = useState<Step>("lobby");
  const [stepLocked, setStepLocked] = useState(false); // prevent double-advancing

  // ── Individual progress (real-time) ──────────────────────────────
  const progress = usePlayerProgress(event.active && !!pseudo, pseudo);

  // ── AUTO-ROUTING ─────────────────────────────────────────────────
  // No global phase check — each player routes independently.
  useEffect(() => {
    if (!pseudo || !player || progress.loading) return;
    if (!event.active) { setStep("event_waiting"); return; }
    if (stepLocked) return; // don't override terminal states

    if (!progress.quizPassed) {
      setStep("quiz");
    } else if (!progress.beastsPassed) {
      setStep("beasts");
    } else {
      setStep("hooh");
    }
  }, [event.active, pseudo, player, progress.loading, progress.quizPassed, progress.beastsPassed, stepLocked]);

  // ── PSEUDO SUBMIT ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const clean = inputValue.trim();
    if (clean.length < 2) return;
    setPlayerLoading(true);
    setPlayerError("");
    const p = await findPlayer(clean);
    setPlayerLoading(false);
    if (!p) {
      setPlayerError(`"${clean}" n'est pas dans le roster. Vérifie l'orthographe.`);
      setStep("not_in_roster");
      return;
    }
    if (p.team.length === 0) {
      setPlayerError(`${clean} n'a pas d'équipe configurée.`);
      return;
    }
    setPseudo(clean);
    setPlayer(p);
    setStep("loading");
  }, [inputValue]);

  // ── QUIZ COMPLETE ────────────────────────────────────────────────
  const onQuizComplete = useCallback((passed: boolean) => {
    // progress will update via Firestore → routing effect fires automatically
    // nothing to do here; the onSnapshot in usePlayerProgress handles it
  }, []);

  // ── BEASTS COMPLETE ───────────────────────────────────────────────
  const onBeastsComplete = useCallback((passed: boolean) => {
    // Same — Firestore progress update triggers auto-route
  }, []);

  // ── HOOH COMPLETE ─────────────────────────────────────────────────
  const onHoohComplete = useCallback((won: boolean) => {
    setStepLocked(true); // freeze routing after final boss
    setStep("done");
  }, []);

  // ── RENDER ────────────────────────────────────────────────────────

  // Loading spinner while checking progress
  if (step === "loading" || (pseudo && player && progress.loading)) {
    return (
      <div className="h-dvh w-full flex items-center justify-center"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #1a0800, #0a0400)", fontFamily: "'Courier New', monospace" }}>
        <SacredFireBG />
        <div className="text-center z-10 relative">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-amber-300/60 text-sm">Connexion à la Tour Cendrée…</p>
        </div>
      </div>
    );
  }

  // Event not active — show waiting screen
  if (step === "event_waiting") {
    return <WaitingScreen pseudo={pseudo} />;
  }

  // Final done screen (managed by HoOhBattle's own ResultScreen)
  if (step === "done") {
    return (
      <div className="h-dvh w-full flex items-center justify-center"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #1a0800, #0a0400)", fontFamily: "'Courier New', monospace" }}>
        <SacredFireBG />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-[#f8f0e0] border-4 border-black p-10 text-center max-w-sm relative z-10"
          style={{ boxShadow: "8px 8px 0 #000, 0 0 40px rgba(251,191,36,.3)" }}>
          <div className="text-5xl mb-4">🌈</div>
          <h1 className="text-2xl font-black text-black mb-2">ÉVÉNEMENT TERMINÉ</h1>
          <p className="text-sm text-gray-700">Merci d'avoir participé, {pseudo} !</p>
        </motion.div>
      </div>
    );
  }

  // Lobby — enter pseudo
  if (step === "lobby" || step === "not_in_roster" || !pseudo || !player) {
    return (
      <LobbyScreen
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSubmit={handleSubmit}
        loading={playerLoading}
        error={playerError}
        eventActive={event.active}
        eventLoading={event.loading}
      />
    );
  }

  // Quiz — Kimono sisters
  if (step === "quiz") {
    return <QuizScreen pseudo={pseudo} onComplete={onQuizComplete} />;
  }

  // 3v3 Beasts battle
  if (step === "beasts") {
    return <BeastsBattle pseudo={pseudo} player={player} onComplete={onBeastsComplete} />;
  }

  // Final boss — Ho-Oh
  if (step === "hooh") {
    return <HoOhBattle pseudo={pseudo} player={player} onComplete={onHoohComplete} />;
  }

  return null;
}

/* ═══════════════════════════════════════════════
   LOBBY SCREEN
   ═══════════════════════════════════════════════ */
function LobbyScreen({
  inputValue, setInputValue, onSubmit, loading, error, eventActive, eventLoading,
}: {
  inputValue: string;
  setInputValue: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  eventActive: boolean;
  eventLoading: boolean;
}) {
  const HOOH_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/250.gif";

  return (
    <div className="h-dvh w-full overflow-hidden relative flex flex-col"
      style={{ background: "linear-gradient(180deg, #050200 0%, #100600 30%, #1a0800 60%, #0a0400 100%)", fontFamily: "'Courier New', monospace" }}>

      {/* ── Ambient top glow ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ width: "800px", height: "400px", background: "radial-gradient(ellipse, rgba(245,158,11,0.10) 0%, transparent 65%)", filter: "blur(40px)" }} />

      {/* ── Fire particles ── */}
      <SacredFireBG />

      {/* ── Rainbow light beams ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"].map((c, i) => (
          <div key={i} className="absolute top-0"
            style={{
              left: `${10 + i * 12}%`, width: "2px", height: "35%",
              background: `linear-gradient(180deg, ${c}00, ${c}18, ${c}00)`,
              transform: `rotate(${-15 + i * 5}deg)`,
              transformOrigin: "top center",
              animation: `beam-pulse ${3 + i * 0.4}s ${i * 0.3}s ease-in-out infinite`,
            }} />
        ))}
      </div>

      {/* ── HERO SECTION — top 65% ── */}
      <div className="flex-1 flex flex-col items-center justify-end pb-6 relative z-10">

        {/* Subtitle badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full border"
          style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)", color: "rgba(245,158,11,0.6)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.4em] uppercase">Ligue RPPLF · Événement Légendaire</span>
        </motion.div>

        {/* Ho-Oh sprite — large and glowing */}
        <motion.div className="relative mb-2"
          animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
          {/* Outer glow ring */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
            style={{ width: "280px", height: "280px", background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 65%)", filter: "blur(25px)", animation: "aura-pulse 3s ease-in-out infinite" }} />
          <img src={HOOH_SPRITE} alt="Ho-Oh"
            style={{
              imageRendering: "pixelated", width: "min(180px, 38vw)", position: "relative",
              filter: "drop-shadow(0 0 30px rgba(245,158,11,0.7)) drop-shadow(0 0 60px rgba(239,68,68,0.3)) brightness(1.1)",
            }}
            onError={e => { e.currentTarget.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/250.png"; }} />
        </motion.div>

        {/* Main title */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center font-black mb-1 leading-none"
          style={{
            fontSize: "clamp(28px, 7vw, 48px)",
            background: "linear-gradient(135deg, #fef3c7 0%, #fbbf24 30%, #f59e0b 55%, #dc2626 80%, #7c2d12 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            textShadow: "none",
            letterSpacing: "-0.02em",
          }}>
          La Quête de Ho-Oh
        </motion.h1>

        {/* Steps indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="flex items-center gap-2 mt-3">
          {[
            { label: "Quiz", icon: "📜", color: "#6366f1" },
            { label: "3v3", icon: "⚔️", color: "#f59e0b" },
            { label: "Ho-Oh", icon: "🌈", color: "#ef4444" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2 py-1 rounded"
                style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                <span className="text-[11px]">{s.icon}</span>
                <span className="text-[9px] font-bold" style={{ color: s.color }}>{s.label}</span>
              </div>
              {i < 2 && <span className="text-amber-800/40 text-[8px]">▶</span>}
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── INPUT SECTION — bottom 35% ── */}
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}
        className="relative z-10 w-full max-w-sm mx-auto px-4 pb-8">

        {/* Event status */}
        <div className="flex justify-center mb-3">
          {eventLoading ? (
            <span className="text-amber-300/20 text-[10px]">Connexion…</span>
          ) : eventActive ? (
            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              className="flex items-center gap-2 px-3 py-1 rounded-full"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-black text-red-400 tracking-wider">ÉVÉNEMENT EN COURS</span>
            </motion.div>
          ) : (
            <span className="text-white/15 text-[10px] tracking-widest">EN ATTENTE DU LANCEMENT</span>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden border"
          style={{ background: "rgba(10,4,0,0.85)", borderColor: "rgba(245,158,11,0.2)", backdropFilter: "blur(20px)", boxShadow: "0 0 60px rgba(245,158,11,0.08), inset 0 1px 0 rgba(245,158,11,0.1)" }}>

          <div className="px-5 pt-5 pb-4">
            <label className="block text-[10px] font-bold mb-2 tracking-widest uppercase" style={{ color: "rgba(245,158,11,0.5)" }}>
              Ton pseudo Dresseur
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && eventActive && onSubmit()}
                placeholder="Ex: Sacha, Ondine…"
                disabled={loading || !eventActive}
                className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none disabled:opacity-40 transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,158,11,0.15)",
                  color: "#fef3c7",
                  caretColor: "#f59e0b",
                }}
              />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mt-2 px-3 py-2 rounded-lg text-[11px] font-bold"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                ⚠️ {error}
              </motion.div>
            )}
          </div>

          {/* CTA Button */}
          <div className="px-5 pb-5">
            <button
              onClick={onSubmit}
              disabled={loading || !eventActive || inputValue.trim().length < 2}
              className="w-full py-3.5 rounded-xl text-sm font-black tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed relative overflow-hidden"
              style={{
                background: eventActive && !loading
                  ? "linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)"
                  : "rgba(255,255,255,0.05)",
                color: eventActive ? "#fff" : "rgba(255,255,255,0.3)",
                boxShadow: eventActive && !loading ? "0 0 30px rgba(245,158,11,0.25), 0 4px 12px rgba(0,0,0,0.4)" : "none",
              }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recherche…
                </span>
              ) : !eventActive ? (
                "Événement non démarré"
              ) : (
                "ENTRER DANS LA TOUR ⚔️"
              )}
              {/* Shimmer */}
              {eventActive && !loading && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)", animation: "shimmer 2.5s infinite" }} />
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-white/10 text-[9px] mt-3 tracking-wide">
          Le pseudo doit correspondre exactement au roster · Casse sensible
        </p>
      </motion.div>

      <style>{`
        @keyframes beam-pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes aura-pulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.6} 50%{transform:translate(-50%,-50%) scale(1.15);opacity:1} }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
      `}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════
   WAITING SCREEN (event not active)
   ═══════════════════════════════════════════════ */
function WaitingScreen({ pseudo }: { pseudo: string }) {
  return (
    <div className="h-dvh w-full flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #1a0800, #0a0400)", fontFamily: "'Courier New', monospace" }}>
      <SacredFireBG />
      <div className="text-center z-10 relative">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
          <img src="https://play.pokemonshowdown.com/sprites/ani/ho-oh.gif" alt="Ho-Oh"
            style={{ imageRendering: "pixelated", width: "100px", margin: "0 auto 20px", filter: "drop-shadow(0 0 15px rgba(245,158,11,.5))" }}
            onError={e => { e.currentTarget.style.display = "none"; }} />
        </motion.div>
        <p className="text-amber-200/50 text-sm mb-1">Bienvenue, {pseudo}.</p>
        <p className="text-amber-300/30 text-xs">L'événement n'est pas encore actif.</p>
        <p className="text-amber-200/15 text-[10px] mt-4">Cette page se met à jour automatiquement.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SACRED FIRE BACKGROUND
   ═══════════════════════════════════════════════ */
function SacredFireBG() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 6,
      duration: 6 + Math.random() * 8, size: 2 + Math.random() * 3,
      opacity: 0.1 + Math.random() * 0.25,
      color: ["#f59e0b", "#ef4444", "#fbbf24", "#f97316"][i % 4],
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, bottom: "-3%", width: p.size, height: p.size,
          backgroundColor: p.color, boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          opacity: p.opacity,
          animation: `lobby-fire ${p.duration}s ${p.delay}s infinite linear`,
        }} />
      ))}
      <style>{`
        @keyframes lobby-fire {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.5; }
          80% { opacity: 0.1; }
          100% { transform: translateY(-100vh) translateX(10px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}