"use client";

import { useCallback, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scene } from "../components/Scene";
import { useEvent, useCapture } from "../hooks/useEvent";

type Phase = "intro" | "idle" | "throwing" | "shaking" | "captured" | "fled";

const BALL_FLIGHT_MS = 800;
const SHAKE_DURATION_MS = 2000;

export default function Page() {
  const event = useEvent();
  const { attempt } = useCapture();

  const [pseudo, setPseudo] = useState("");
  const [pseudoConfirmed, setPseudoConfirmed] = useState(false);

  const [phase, setPhase] = useState<Phase>("intro");
  const [message, setMessage] = useState("Une présence étrange apparaît…");
  const [throwing, setThrowing] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const onIntroDone = useCallback(() => {
    setPhase("idle");
    setMessage("Un Suicune sauvage apparaît !");
  }, []);

  const onBallHit = useCallback(() => {
    setPhase("shaking");
    setMessage("…");
  }, []);

  const throwBall = useCallback(async () => {
    if (throwing || phase !== "idle") return;
    setThrowing(true);
    setPhase("throwing");
    setMessage("Lancer !");
    setAttempts((a) => a + 1);

    const successPromise = attempt(pseudo);
    await sleep(BALL_FLIGHT_MS);
    const success = await successPromise;
    await sleep(SHAKE_DURATION_MS);

    if (success) {
      setPhase("captured");
      setMessage("Félicitations ! Suicune a été capturé !");
    } else {
      setPhase("fled");
      setMessage("Oh non… Suicune s'est échappé !");
    }

    setThrowing(false);
  }, [attempt, throwing, phase, pseudo]);

  const reset = useCallback(() => {
    setPhase("intro");
    setMessage("Une présence étrange apparaît…");
    setThrowing(false);
  }, []);

  useEffect(() => {
    if (!event.active && phase !== "intro" && !event.loading) {
      setPhase("intro");
      setMessage("L'événement est terminé.");
    }
  }, [event.active, event.loading, phase]);

  const canThrow = phase === "idle" && !throwing && event.active;
  const showResult = phase === "captured" || phase === "fled";

  /* ─── Lobby (offline) ─── */
  if (!event.active && !event.loading && phase === "intro") {
    return <LobbyScreen />;
  }

  /* ─── Pseudo screen (event active but no pseudo yet) ─── */
  if (event.active && !pseudoConfirmed) {
    return (
      <PseudoScreen
        pseudo={pseudo}
        setPseudo={setPseudo}
        onConfirm={() => {
          if (pseudo.trim().length >= 2) {
            setPseudoConfirmed(true);
          }
        }}
      />
    );
  }

  /* ─── Encounter ─── */
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        <Scene phase={phase} onIntroDone={onIntroDone} onBallHit={onBallHit} />
      </div>

      <div className="relative z-10 pointer-events-none">
        <TopBar event={event} attempts={attempts} pseudo={pseudo} />
      </div>

      <div className="fixed bottom-28 right-5 z-10 pointer-events-none">
        <img
          src="/textures/logo.png"
          alt="RPPLF League"
          className="w-14 sm:w-18 opacity-60"
          style={{ filter: "drop-shadow(0 0 8px rgba(0,0,0,0.6))" }}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 pointer-events-none p-4 sm:p-5">
        <div className="mx-auto max-w-2xl">
          <EncounterHUD
            phase={phase}
            message={message}
            canThrow={canThrow}
            onThrow={throwBall}
            onReset={reset}
            showResult={showResult}
          />
        </div>
      </div>

      <AnimatePresence>
        {showResult && (
          <ResultOverlay phase={phase} onReset={reset} pseudo={pseudo} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   PSEUDO SCREEN
   ═══════════════════════════════════════════════ */

function PseudoScreen({
  pseudo,
  setPseudo,
  onConfirm,
}: {
  pseudo: string;
  setPseudo: (v: string) => void;
  onConfirm: () => void;
}) {
  const valid = pseudo.trim().length >= 2;

  return (
    <div className="lobby-bg h-dvh w-full flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <span className="event-badge event-badge-live">
            <span className="live-dot" />
            Événement en cours
          </span>
        </div>

        <h1
          className="text-3xl sm:text-4xl font-black mb-2 text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Qui es-tu, dresseur ?
        </h1>
        <p className="text-sm text-white/40 mb-8">
          Entre ton pseudo pour participer à la rencontre
        </p>

        <div className="mb-6">
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value.substring(0, 30))}
            onKeyDown={(e) => e.key === "Enter" && valid && onConfirm()}
            placeholder="Ton pseudo..."
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-lg text-center font-semibold outline-none focus:border-cyan-400/40 focus:bg-white/8 transition-all placeholder:text-white/20"
          />
          <p className="text-xs text-white/20 mt-2">
            2 à 30 caractères
          </p>
        </div>

        <button
          onClick={onConfirm}
          disabled={!valid}
          className="btn-throw w-full text-lg py-4 disabled:opacity-30"
        >
          Entrer dans l'arène
        </button>

        <div className="mt-8 flex justify-center">
          <img
            src="/textures/logo.png"
            alt="RPPLF League"
            className="w-20 opacity-40"
          />
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LOBBY SCREEN
   ═══════════════════════════════════════════════ */

function LobbyScreen() {
  return (
    <div className="lobby-bg h-dvh w-full flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative"
      >
        <div className="flex justify-center mb-6">
          <span className="event-badge event-badge-offline">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Hors ligne
          </span>
        </div>

        <h1 className="lobby-title text-5xl sm:text-7xl mb-4">SUICUNE</h1>
        <p className="text-lg sm:text-xl text-blue-200/50 font-medium mb-2">
          Encounter Event
        </p>

        <div className="w-16 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent mx-auto my-8" />

        <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed mb-3">
          L'événement n'est pas actif pour le moment.
          Quand il sera lancé, vous aurez <strong className="text-white/60">10 minutes</strong> pour
          tenter de capturer Suicune.
        </p>
        <p className="text-xs text-white/25">
          Taux de capture : <span className="text-cyan-400/60 font-semibold">0.5%</span> — Bonne chance.
        </p>

        <div className="mt-10 flex justify-center">
          <img
            src="/textures/logo.png"
            alt="RPPLF League"
            className="w-28 sm:w-36 object-contain drop-shadow-lg"
            style={{ filter: "drop-shadow(0 0 20px rgba(56, 140, 255, 0.15))" }}
          />
        </div>
      </motion.div>

      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-white/15 tracking-widest uppercase">
          RPPLF League France
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TOP BAR
   ═══════════════════════════════════════════════ */

function TopBar({
  event,
  attempts,
  pseudo,
}: {
  event: ReturnType<typeof useEvent>;
  attempts: number;
  pseudo: string;
}) {
  const isUrgent = event.remaining < 60 && event.remaining > 0;

  return (
    <div className="flex items-start justify-between p-4 sm:p-5">
      <div className="hud-panel-sm px-4 py-3 flex items-center gap-3 pointer-events-auto">
        {event.active ? (
          <>
            <span className="event-badge event-badge-live" style={{ padding: "4px 10px", fontSize: 11 }}>
              <span className="live-dot" />
              Live
            </span>
            <div
              className={`timer-digit text-xl font-bold tracking-tight ${isUrgent ? "text-red-400" : "text-white"}`}
              style={isUrgent ? { animation: "countdown-pulse 0.8s infinite" } : undefined}
            >
              {event.display}
            </div>
          </>
        ) : (
          <span className="text-xs text-white/40">Chargement…</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Pseudo badge */}
        <div className="hud-panel-sm px-3 py-2 pointer-events-auto">
          <span className="text-xs text-white/50">{pseudo}</span>
        </div>

        {attempts > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hud-panel-sm px-4 py-3 pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <div className="pokeball-icon" />
              <span className="text-sm text-white/70">
                <span className="font-bold text-white">{attempts}</span> lancé{attempts > 1 ? "s" : ""}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ENCOUNTER HUD
   ═══════════════════════════════════════════════ */

function EncounterHUD({
  phase,
  message,
  canThrow,
  onThrow,
  onReset,
  showResult,
}: {
  phase: Phase;
  message: string;
  canThrow: boolean;
  onThrow: () => void;
  onReset: () => void;
  showResult: boolean;
}) {
  if (showResult) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
      className="hud-panel p-4 sm:p-5 pointer-events-auto"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400/70">
              Rencontre
            </span>
            <span className="text-xs text-white/20">•</span>
            <span className="text-xs text-white/30">Légendaire</span>
          </div>

          <AnimatePresence mode="popLayout">
            <motion.p
              key={message}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-base sm:text-lg font-bold text-white truncate"
            >
              {message}
            </motion.p>
          </AnimatePresence>

          <p className="text-xs text-white/30 mt-1">
            Taux de capture : <span className="text-cyan-400/60 font-mono font-semibold">0.5%</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onThrow} disabled={!canThrow} className="btn-throw">
            <span className="flex items-center gap-2">
              <span className="pokeball-icon" />
              Lancer
            </span>
          </button>
          <button onClick={onReset} className="btn-secondary">Reset</button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   RESULT OVERLAY
   ═══════════════════════════════════════════════ */

function ResultOverlay({
  phase,
  onReset,
  pseudo,
}: {
  phase: Phase;
  onReset: () => void;
  pseudo: string;
}) {
  const captured = phase === "captured";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="result-overlay"
    >
      <div
        className="absolute inset-0"
        style={{
          background: captured
            ? "radial-gradient(ellipse at center, rgba(250, 204, 21, 0.12) 0%, rgba(0,0,0,0.6) 70%)"
            : "radial-gradient(ellipse at center, rgba(100, 116, 139, 0.08) 0%, rgba(0,0,0,0.6) 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        className="result-card hud-panel relative"
      >
        {captured && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
        )}

        <div className="mb-4">
          {captured ? (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.4, delay: 0.3 }}
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(245, 158, 11, 0.1))",
                border: "1px solid rgba(250, 204, 21, 0.3)",
                boxShadow: "0 0 40px rgba(250, 204, 21, 0.15)",
              }}
            >
              <span className="text-2xl">✦</span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(100, 116, 139, 0.12)",
                border: "1px solid rgba(100, 116, 139, 0.2)",
              }}
            >
              <span className="text-2xl opacity-50">—</span>
            </motion.div>
          )}
        </div>

        <h2
          className="text-xl sm:text-2xl font-bold mb-2"
          style={{ fontFamily: "var(--font-display)", color: captured ? "#fbbf24" : "#94a3b8" }}
        >
          {captured ? "Capturé !" : "Échappé…"}
        </h2>

        <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
          {captured
            ? `Bravo ${pseudo} ! Tu as capturé le légendaire Suicune !`
            : "Suicune s'est enfui dans la nuit. Retentez votre chance !"}
        </p>

        <button onClick={onReset} className="btn-secondary pointer-events-auto">
          {captured ? "Rejouer" : "Réessayer"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
