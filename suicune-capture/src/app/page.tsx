"use client";

import { useCallback, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scene } from "../components/Scene";
import { useEvent, useCapture } from "../hooks/useEvent";

/* ─── Phase types ─── */

type Phase =
  | "intro"    // camera swooping in, portal opening
  | "idle"     // Suicune visible, player can throw
  | "throwing" // ball in flight
  | "shaking"  // ball wobbling on ground
  | "captured" // success!
  | "fled";    // Suicune escaped

/* ─── Constants ─── */

const BALL_FLIGHT_MS = 800;
const SHAKE_DURATION_MS = 2000;

export default function Page() {
  const event = useEvent();
  const { attempt, busy: captureBusy } = useCapture();

  const [phase, setPhase] = useState<Phase>("intro");
  const [message, setMessage] = useState("Une présence étrange apparaît…");
  const [throwing, setThrowing] = useState(false);
  const [attempts, setAttempts] = useState(0);

  /* ─── Callbacks ─── */

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

    // Fire the API immediately, await later
    const successPromise = attempt();

    // Wait for ball to reach Suicune
    await sleep(BALL_FLIGHT_MS);

    // Ball is now shaking (onBallHit will fire from Scene)
    const success = await successPromise;

    // Let the shake animation play
    await sleep(SHAKE_DURATION_MS);

    if (success) {
      setPhase("captured");
      setMessage("Félicitations ! Suicune a été capturé !");
    } else {
      setPhase("fled");
      setMessage("Oh non… Suicune s'est échappé !");
    }

    setThrowing(false);
  }, [attempt, throwing, phase]);

  const reset = useCallback(() => {
    setPhase("intro");
    setMessage("Une présence étrange apparaît…");
    setThrowing(false);
  }, []);

  /* ─── Auto-reset if event ends mid-encounter ─── */
  useEffect(() => {
    if (!event.active && phase !== "intro" && !event.loading) {
      setPhase("intro");
      setMessage("L'événement est terminé.");
    }
  }, [event.active, event.loading, phase]);

  const canThrow = phase === "idle" && !throwing && event.active;
  const showResult = phase === "captured" || phase === "fled";

  /* ─── Render: Lobby (event offline) ─── */

  if (!event.active && !event.loading && phase === "intro") {
    return <LobbyScreen />;
  }

  /* ─── Render: Encounter ─── */

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {/* 3D Scene */}
      <div className="absolute inset-0">
        <Scene phase={phase} onIntroDone={onIntroDone} onBallHit={onBallHit} />
      </div>

      {/* Top Bar: Timer + Event badge */}
      <div className="relative z-10 pointer-events-none">
        <TopBar event={event} attempts={attempts} />
      </div>

      {/* Bottom HUD */}
      <div className="relative z-10 pointer-events-none absolute bottom-0 left-0 right-0 p-4 sm:p-6">
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

      {/* Full-screen capture/fled overlay */}
      <AnimatePresence>
        {showResult && (
          <ResultOverlay phase={phase} onReset={reset} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════ */

/* ─── Lobby Screen ─── */

function LobbyScreen() {
  return (
    <div className="lobby-bg h-dvh w-full flex flex-col items-center justify-center p-6 text-center">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative"
      >
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="event-badge event-badge-offline">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Hors ligne
          </span>
        </div>

        {/* Title */}
        <h1 className="lobby-title text-5xl sm:text-7xl mb-4">
          SUICUNE
        </h1>
        <p className="text-lg sm:text-xl text-blue-200/50 font-medium mb-2">
          Encounter Event
        </p>

        {/* Divider */}
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent mx-auto my-8" />

        {/* Info */}
        <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed mb-3">
          L'événement n'est pas actif pour le moment.
          Quand il sera lancé, vous aurez <strong className="text-white/60">10 minutes</strong> pour
          tenter de capturer Suicune.
        </p>
        <p className="text-xs text-white/25">
          Taux de capture : <span className="text-cyan-400/60 font-semibold">0.5%</span> — Bonne chance.
        </p>

              {/* RPPLF Logo */}
      <div className="mt-10 flex justify-center">
        <img
          src="/textures/logo.png"
          alt="RPPLF League"
          className="w-28 sm:w-36 object-contain drop-shadow-lg"
          style={{ filter: "drop-shadow(0 0 20px rgba(56, 140, 255, 0.15))" }}
        />
      </div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-white/15 tracking-widest uppercase">
          RPPLF League France
        </p>
      </div>
    </div>
  );
}

/* ─── Top Bar ─── */

function TopBar({
  event,
  attempts,
}: {
  event: ReturnType<typeof useEvent>;
  attempts: number;
}) {
  const isUrgent = event.remaining < 60 && event.remaining > 0;

  return (
    <div className="flex items-start justify-between p-4 sm:p-5">
      {/* Left: Event status */}
      <div className="hud-panel-sm px-4 py-3 flex items-center gap-3 pointer-events-auto">
        {event.active ? (
          <>
            <span className="event-badge event-badge-live" style={{ padding: "4px 10px", fontSize: 11 }}>
              <span className="live-dot" />
              Live
            </span>
            <div className={`timer-digit text-xl font-bold tracking-tight ${isUrgent ? "text-red-400" : "text-white"}`}
              style={isUrgent ? { animation: "countdown-pulse 0.8s infinite" } : undefined}
            >
              {event.display}
            </div>
          </>
        ) : (
          <span className="text-xs text-white/40">Chargement…</span>
        )}
      </div>

      {/* Right: Attempts counter */}
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
  );
}

/* ─── Encounter HUD (bottom panel) ─── */

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
        {/* Left: Info */}
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

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onThrow}
            disabled={!canThrow}
            className="btn-throw"
          >
            <span className="flex items-center gap-2">
              <span className="pokeball-icon" />
              Lancer
            </span>
          </button>

          <button onClick={onReset} className="btn-secondary">
            Reset
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Result Overlay ─── */

function ResultOverlay({
  phase,
  onReset,
}: {
  phase: Phase;
  onReset: () => void;
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
      {/* Background dim/glow */}
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
        {/* Decorative top glow */}
        {captured && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
        )}

        {/* Icon */}
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

        {/* Text */}
        <h2
          className="text-xl sm:text-2xl font-bold mb-2"
          style={{
            fontFamily: "var(--font-display)",
            color: captured ? "#fbbf24" : "#94a3b8",
          }}
        >
          {captured ? "Capturé !" : "Échappé…"}
        </h2>

        <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
          {captured
            ? "Incroyable ! Vous avez capturé le légendaire Suicune !"
            : "Suicune s'est enfui dans la nuit. Retentez votre chance !"}
        </p>

        <button onClick={onReset} className="btn-secondary pointer-events-auto">
          {captured ? "Rejouer" : "Réessayer"}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Utils ─── */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
