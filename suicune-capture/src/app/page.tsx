"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scene } from "../components/Scene";
import { useEvent, useCapture, useCheckAttempts, CaptureResult } from "../hooks/useEvent";
import { getPokemonConfig } from "../lib/pokemonConfig";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MAX_ATTEMPTS = 3;

type Phase = "intro" | "idle" | "throwing" | "shaking" | "captured" | "fled" | "exhausted";

const BALL_FLIGHT_MS = 800;
const SHAKE_DURATION_MS = 2000;

export default function Page() {
  const event = useEvent();
  const { attempt } = useCapture();
  const check = useCheckAttempts(event.active);
  const cfg = useMemo(() => getPokemonConfig(event.pokemon), [event.pokemon]);

  const [pseudo, setPseudo] = useState("");
  const [pseudoConfirmed, setPseudoConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [message, setMessage] = useState("Une présence étrange apparaît…");
  const [throwing, setThrowing] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);

  const pokeName = cfg.displayName;

  const onIntroDone = useCallback(() => {
    setPhase("idle");
    setMessage(`Un ${pokeName} sauvage apparaît !`);
  }, [pokeName]);

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

    const resultPromise = attempt(pseudo, event.pokemon);
    await sleep(BALL_FLIGHT_MS);
    const result: CaptureResult = await resultPromise;
    await sleep(SHAKE_DURATION_MS);

    if (result.reason === "max_attempts") {
      setPhase("exhausted");
      setMessage("Vous avez utilisé tous vos essais…");
      setAttemptsRemaining(0);
      setThrowing(false);
      return;
    }

    const remaining = result.attemptsRemaining ?? 0;
    setAttemptsRemaining(remaining);

    if (result.success) {
      setPhase("captured");
      setMessage(`Félicitations ! ${pokeName} a été capturé !`);
    } else if (remaining <= 0) {
      setPhase("fled");
      setMessage(`${pokeName} s'enfuit dans la nuit…`);
    } else {
      setPhase("idle");
      setMessage(
        remaining === 1
          ? "Raté… Dernière chance, dresseur !"
          : `Ah presque ! ${pokeName} vous observe…`
      );
    }

    setThrowing(false);
  }, [attempt, throwing, phase, pseudo, pokeName, event.pokemon]);

  const reset = useCallback(() => {
    setPhase("intro");
    setMessage("Une présence étrange apparaît…");
    setThrowing(false);
  }, []);

  useEffect(() => {
    if (!event.active && phase !== "intro" && !event.loading) {
      setPhase("intro");
      setMessage("L'événement est terminé.");
      setAttempts(0);
      setAttemptsRemaining(MAX_ATTEMPTS);
    }
  }, [event.active, event.loading, phase]);

  const canThrow = phase === "idle" && !throwing && event.active && attemptsRemaining > 0;
  const showResult = phase === "captured" || phase === "fled" || phase === "exhausted";

  if (!event.active && !event.loading && phase === "intro") {
    return <LobbyScreen pokemon={event.pokemon} />;
  }

  /* Block if device already used all attempts or already won */
  if (event.active && !check.loading && check.blocked) {
    return <BlockedScreen cfg={cfg} hasWon={check.hasWon} />;
  }

  if (event.active && !pseudoConfirmed) {
    return (
      <PseudoScreen
        pseudo={pseudo}
        setPseudo={setPseudo}
        cfg={cfg}
        onConfirm={() => { if (pseudo.trim().length >= 2) setPseudoConfirmed(true); }}
      />
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        <Scene phase={phase === "exhausted" ? "idle" : phase} onIntroDone={onIntroDone} onBallHit={onBallHit} pokemon={event.pokemon} />
      </div>

      <div className="relative z-10 pointer-events-none">
        <TopBar event={event} attempts={attempts} pseudo={pseudo} attemptsRemaining={attemptsRemaining} cfg={cfg} />
      </div>

      <div className="fixed bottom-28 right-5 z-10 pointer-events-none">
        <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF League" className="w-14 sm:w-18 opacity-60" style={{ filter: "drop-shadow(0 0 8px rgba(0,0,0,0.6))" }} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 pointer-events-none p-4 sm:p-5">
        <div className="mx-auto max-w-2xl">
          <EncounterHUD phase={phase} message={message} canThrow={canThrow} onThrow={throwBall} showResult={showResult} attemptsRemaining={attemptsRemaining} cfg={cfg} />
        </div>
      </div>

      <AnimatePresence>
        {showResult && <ResultOverlay phase={phase} onReset={reset} pseudo={pseudo} cfg={cfg} />}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */

function PseudoScreen({ pseudo, setPseudo, onConfirm, cfg }: {
  pseudo: string; setPseudo: (v: string) => void; onConfirm: () => void; cfg: ReturnType<typeof getPokemonConfig>;
}) {
  const valid = pseudo.trim().length >= 2;
  const isFireType = cfg.name === "entei";

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden" style={{ background: isFireType ? "linear-gradient(180deg, #1a0808 0%, #0d0404 50%, #050810 100%)" : undefined }}>
      {/* Animated fire glow for Entei */}
      {isFireType && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(239, 68, 68, 0.12) 0%, rgba(249, 115, 22, 0.06) 40%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-0 right-0 h-[60%] pointer-events-none animate-pulse" style={{ background: "radial-gradient(ellipse at 30% 100%, rgba(245, 158, 11, 0.08) 0%, transparent 50%)", animationDuration: "3s" }} />
          <div className="absolute bottom-0 left-0 right-0 h-[50%] pointer-events-none animate-pulse" style={{ background: "radial-gradient(ellipse at 70% 100%, rgba(239, 68, 68, 0.06) 0%, transparent 50%)", animationDuration: "4s", animationDelay: "1s" }} />
          <FireEmbers />
        </>
      )}
      {!isFireType && <div className="lobby-bg absolute inset-0" />}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ background: `${cfg.accentColorHex}08` }} />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} className="relative w-full max-w-sm z-10">
        <div className="flex justify-center mb-6">
          <span className="event-badge event-badge-live"><span className="live-dot" />Événement en cours</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-2 text-white" style={{ fontFamily: "var(--font-display)" }}>Qui es-tu, dresseur ?</h1>
        <p className="text-sm text-white/40 mb-8">Entre ton pseudo pour affronter {cfg.displayName}</p>
        <div className="mb-6">
          <input type="text" value={pseudo} onChange={(e) => setPseudo(e.target.value.substring(0, 30))} onKeyDown={(e) => e.key === "Enter" && valid && onConfirm()} placeholder="Ton pseudo..." autoFocus className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-lg text-center font-semibold outline-none focus:border-cyan-400/40 focus:bg-white/8 transition-all placeholder:text-white/20" />
          <p className="text-xs text-white/20 mt-2">2 à 30 caractères · 3 essais par événement</p>
        </div>
        <button onClick={onConfirm} disabled={!valid} className="btn-throw w-full text-lg py-4 disabled:opacity-30">Entrer dans l'arène</button>
        <div className="mt-8 flex justify-center">
          <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF League" className="w-20 opacity-40" />
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   BLOCKED SCREEN — device already used all attempts
   ═══════════════════════════════════════════════ */

function BlockedScreen({ cfg, hasWon }: { cfg: ReturnType<typeof getPokemonConfig>; hasWon: boolean }) {
  const isFireType = cfg.name === "entei";

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden" style={{ background: isFireType ? "linear-gradient(180deg, #1a0808 0%, #0d0404 50%, #050810 100%)" : undefined }}>
      {isFireType && <FireEmbers />}
      {!isFireType && <div className="lobby-bg absolute inset-0" />}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-sm text-center"
      >
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{
          background: hasWon ? "linear-gradient(135deg, rgba(250, 204, 21, 0.15), rgba(245, 158, 11, 0.08))" : "rgba(100, 116, 139, 0.1)",
          border: hasWon ? "1px solid rgba(250, 204, 21, 0.25)" : "1px solid rgba(100, 116, 139, 0.15)",
        }}>
          <span className="text-3xl">{hasWon ? "✦" : "✕"}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
          {hasWon ? "Déjà capturé !" : "Plus d'essais"}
        </h1>

        <p className="text-sm text-white/40 leading-relaxed mb-4">
          {hasWon
            ? `Vous avez déjà capturé ${cfg.displayName} durant cet événement. Bravo !`
            : `Vous avez déjà utilisé vos 3 essais pour cet événement ${cfg.displayName}. Attendez le prochain événement.`}
        </p>

        <p className="text-xs text-white/20">
          Cet appareil a été reconnu. Changer de pseudo ne changera rien.
        </p>

        <div className="mt-8 flex justify-center">
          <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF League" className="w-20 opacity-30" />
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LOBBY SCREEN
   ═══════════════════════════════════════════════ */

function LobbyScreen({ pokemon }: { pokemon: string }) {
  const cfg = getPokemonConfig(pokemon);
  const isFireType = cfg.name === "entei";

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden" style={{ background: isFireType ? "linear-gradient(180deg, #1a0808 0%, #0d0404 50%, #050810 100%)" : undefined }}>
      {isFireType && (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(239, 68, 68, 0.12) 0%, rgba(249, 115, 22, 0.06) 40%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-0 right-0 h-[60%] pointer-events-none animate-pulse" style={{ background: "radial-gradient(ellipse at 30% 100%, rgba(245, 158, 11, 0.08) 0%, transparent 50%)", animationDuration: "3s" }} />
          <div className="absolute bottom-0 left-0 right-0 h-[50%] pointer-events-none animate-pulse" style={{ background: "radial-gradient(ellipse at 70% 100%, rgba(239, 68, 68, 0.06) 0%, transparent 50%)", animationDuration: "4s", animationDelay: "1s" }} />
          <FireEmbers />
        </>
      )}
      {!isFireType && <div className="lobby-bg absolute inset-0" />}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ background: `${cfg.accentColorHex}08` }} />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="relative">
        <div className="flex justify-center mb-6">
          <span className="event-badge event-badge-offline"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Hors ligne</span>
        </div>
        <h1 className="text-5xl sm:text-7xl mb-4 font-black" style={{ fontFamily: "var(--font-display)", background: cfg.titleGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {cfg.displayName.toUpperCase()}
        </h1>
        <p className="text-lg sm:text-xl font-medium mb-2" style={{ color: `${cfg.accentColorHex}60` }}>Encounter Event</p>
        <div className="w-16 h-px mx-auto my-8" style={{ background: `linear-gradient(to right, transparent, ${cfg.accentColorHex}40, transparent)` }} />
        <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed mb-3">
          L'événement n'est pas actif pour le moment. Quand il sera lancé, vous aurez <strong className="text-white/60">10 minutes</strong> et <strong className="text-white/60">3 essais</strong> pour tenter de capturer {cfg.displayName}.
        </p>
        <p className="text-xs text-white/25">
          Taux de capture : <span className="font-semibold" style={{ color: `${cfg.accentColorHex}80` }}>0.2%</span> — Bonne chance.
        </p>
        <div className="mt-10 flex justify-center">
          <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF League" className="w-28 sm:w-36 object-contain drop-shadow-lg" style={{ filter: `drop-shadow(0 0 20px ${cfg.accentColorHex}20)` }} />
        </div>
      </motion.div>
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-white/15 tracking-widest uppercase">RPPLF League France</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */

function TopBar({ event, attempts, pseudo, attemptsRemaining, cfg }: {
  event: ReturnType<typeof useEvent>; attempts: number; pseudo: string; attemptsRemaining: number; cfg: ReturnType<typeof getPokemonConfig>;
}) {
  const isUrgent = event.remaining < 60 && event.remaining > 0;
  return (
    <div className="flex items-start justify-between p-4 sm:p-5">
      <div className="hud-panel-sm px-4 py-3 flex items-center gap-3 pointer-events-auto">
        {event.active ? (
          <>
            <span className="event-badge event-badge-live" style={{ padding: "4px 10px", fontSize: 11 }}><span className="live-dot" />Live</span>
            <div className={`timer-digit text-xl font-bold tracking-tight ${isUrgent ? "text-red-400" : "text-white"}`} style={isUrgent ? { animation: "countdown-pulse 0.8s infinite" } : undefined}>{event.display}</div>
          </>
        ) : (
          <span className="text-xs text-white/40">Chargement…</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="hud-panel-sm px-3 py-2 pointer-events-auto"><span className="text-xs text-white/50">{pseudo}</span></div>
        <div className="hud-panel-sm px-3 py-2 pointer-events-auto flex items-center gap-1.5">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
            <div key={i} className="pokeball-icon" style={{ width: 14, height: 14, opacity: i < (MAX_ATTEMPTS - attemptsRemaining) ? 0.2 : 1, filter: i < (MAX_ATTEMPTS - attemptsRemaining) ? "grayscale(1)" : "none" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */

function EncounterHUD({ phase, message, canThrow, onThrow, showResult, attemptsRemaining, cfg }: {
  phase: Phase; message: string; canThrow: boolean; onThrow: () => void; showResult: boolean; attemptsRemaining: number; cfg: ReturnType<typeof getPokemonConfig>;
}) {
  if (showResult) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }} className="hud-panel p-4 sm:p-5 pointer-events-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${cfg.accentColorHex}90` }}>Rencontre</span>
            <span className="text-xs text-white/20">•</span>
            <span className="text-xs text-white/30">Légendaire</span>
          </div>
          <AnimatePresence mode="popLayout">
            <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="text-base sm:text-lg font-bold text-white truncate">{message}</motion.p>
          </AnimatePresence>
          <p className="text-xs text-white/30 mt-1">
            Taux de capture : <span className="font-mono font-semibold" style={{ color: `${cfg.accentColorHex}80` }}>0.2%</span>
            <span className="text-white/15 mx-2">·</span>
            <span className={attemptsRemaining <= 1 ? "text-red-400/60" : "text-white/30"}>{attemptsRemaining} essai{attemptsRemaining > 1 ? "s" : ""} restant{attemptsRemaining > 1 ? "s" : ""}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onThrow} disabled={!canThrow} className="btn-throw">
            <span className="flex items-center gap-2"><span className="pokeball-icon" />Lancer</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════ */

function ResultOverlay({ phase, onReset, pseudo, cfg }: {
  phase: Phase; onReset: () => void; pseudo: string; cfg: ReturnType<typeof getPokemonConfig>;
}) {
  const captured = phase === "captured";
  const exhausted = phase === "exhausted";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="result-overlay">
      <div className="absolute inset-0" style={{
        background: captured
          ? "radial-gradient(ellipse at center, rgba(250, 204, 21, 0.12) 0%, rgba(0,0,0,0.6) 70%)"
          : "radial-gradient(ellipse at center, rgba(100, 116, 139, 0.08) 0%, rgba(0,0,0,0.6) 70%)",
      }} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }} className="result-card hud-panel relative">
        {captured && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />}
        <div className="mb-4">
          {captured ? (
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.6, type: "spring", bounce: 0.4, delay: 0.3 }} className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(245, 158, 11, 0.1))", border: "1px solid rgba(250, 204, 21, 0.3)", boxShadow: "0 0 40px rgba(250, 204, 21, 0.15)" }}>
              <span className="text-2xl">✦</span>
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(100, 116, 139, 0.12)", border: "1px solid rgba(100, 116, 139, 0.2)" }}>
              <span className="text-2xl opacity-50">—</span>
            </motion.div>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)", color: captured ? "#fbbf24" : "#94a3b8" }}>
          {captured ? "Capturé !" : exhausted ? "Plus d'essais…" : "Échappé…"}
        </h2>
        <p className="text-sm text-white/50 mb-6 max-w-xs mx-auto">
          {captured
            ? `Bravo ${pseudo} ! Tu as capturé le légendaire ${cfg.displayName} !`
            : exhausted
            ? `Vous avez utilisé vos 3 essais. ${cfg.displayName} s'éloigne lentement…`
            : `${cfg.displayName} s'est enfui dans la nuit. Vos 3 essais sont épuisés.`}
        </p>
        {captured && <button onClick={onReset} className="btn-secondary pointer-events-auto">Fermer</button>}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   FIRE EMBERS — floating particles for fire-type screens
   ═══════════════════════════════════════════════ */

function FireEmbers() {
  const embers = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 6,
      size: 2 + Math.random() * 4,
      opacity: 0.3 + Math.random() * 0.5,
      drift: -20 + Math.random() * 40,
      color: Math.random() > 0.5 ? "#f97316" : Math.random() > 0.5 ? "#ef4444" : "#fbbf24",
    })),
  []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {embers.map((e) => (
        <div
          key={e.id}
          className="absolute rounded-full"
          style={{
            left: `${e.left}%`,
            bottom: "-5%",
            width: e.size,
            height: e.size,
            backgroundColor: e.color,
            boxShadow: `0 0 ${e.size * 2}px ${e.color}`,
            opacity: e.opacity,
            animation: `ember-rise ${e.duration}s ${e.delay}s infinite linear`,
          }}
        />
      ))}
      <style>{`
        @keyframes ember-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
