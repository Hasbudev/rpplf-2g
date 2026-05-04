"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scene } from "../components/Scene";
import { RaikouBattle } from "../components/RaikouBattle";
import { QuizScreen } from "../components/QuizScreen";
import { BeastsBattle } from "../components/BeastsBattle";
import { HoOhBattle } from "../components/HoOhBattle";
import { CreditsScreen } from "../components/CreditsScreen";
import { useEvent, useCapture, useCheckAttempts, usePlayerProgress, resetBossProgress, CaptureResult } from "../hooks/useEvent";
import { getPokemonConfig } from "../lib/pokemonConfig";
import { fetchPlayers, REQUIRED_BADGES, type Player } from "../lib/playerRoster";

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
  const [inRaikouBattle, setInRaikouBattle] = useState(false);
  const [inBossEvent, setInBossEvent] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  // Boss event progress tracker
  const progress = usePlayerProgress(event.active && event.eventType === "boss_event", pseudo);

  const pokeName = cfg.displayName;
  const isBossEvent = event.eventType === "boss_event";

  // Load player data when pseudo confirmed (for boss events)
  useEffect(() => {
    if (!pseudoConfirmed || !pseudo) return;
    (async () => {
      const players = await fetchPlayers();
      const found = players.find((p) => p.name.toLowerCase() === pseudo.toLowerCase());
      setPlayer(found || null);
    })();
  }, [pseudoConfirmed, pseudo]);

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
    if (result.reason === "max_attempts") { setPhase("exhausted"); setMessage("Vous avez utilisé tous vos essais…"); setAttemptsRemaining(0); setThrowing(false); return; }
    const remaining = result.attemptsRemaining ?? 0;
    setAttemptsRemaining(remaining);
    if (result.success) { setPhase("captured"); setMessage(`Félicitations ! ${pokeName} a été capturé !`); }
    else if (remaining <= 0) { setPhase("fled"); setMessage(`${pokeName} s'enfuit dans la nuit…`); }
    else { setPhase("idle"); setMessage(remaining === 1 ? "Raté… Dernière chance !" : `Ah presque ! ${pokeName} vous observe…`); }
    setThrowing(false);
  }, [attempt, throwing, phase, pseudo, pokeName, event.pokemon]);

  const reset = useCallback(() => { setPhase("intro"); setMessage("Une présence étrange apparaît…"); setThrowing(false); }, []);

  useEffect(() => {
    if (!event.active && phase !== "intro" && !event.loading && !inRaikouBattle && !inBossEvent) {
      setPhase("intro"); setMessage("L'événement est terminé."); setAttempts(0); setAttemptsRemaining(MAX_ATTEMPTS);
    }
  }, [event.active, event.loading, phase, inRaikouBattle, inBossEvent]);

  const canThrow = phase === "idle" && !throwing && event.active && attemptsRemaining > 0;
  const showResult = phase === "captured" || phase === "fled" || phase === "exhausted";

  // ═══════════════════════════════════════════════
  // CREDITS (après victoire Ho-Oh)
  // ═══════════════════════════════════════════════
  if (showCredits) {
    return (
      <CreditsScreen pseudo={pseudo} won={true} onClose={() => {
        setShowCredits(false);
        setInBossEvent(false);
        setPseudoConfirmed(false);
        setPseudo("");
        setPhase("intro");
      }} />
    );
  }

  // ═══════════════════════════════════════════════
  // LOBBY (no event)
  // ═══════════════════════════════════════════════
  if (!event.active && !event.loading && phase === "intro" && !inRaikouBattle && !inBossEvent) {
    return <LobbyScreen pokemon={event.pokemon} isBossEvent={isBossEvent} />;
  }

  // ═══════════════════════════════════════════════
  // BOSS EVENT FLOW
  // ═══════════════════════════════════════════════
  if (event.active && isBossEvent) {
    // Pseudo input
    if (!pseudoConfirmed && !inBossEvent) {
      return (
        <PseudoScreen pseudo={pseudo} setPseudo={setPseudo} cfg={cfg}
          onConfirm={() => { if (pseudo.trim().length >= 2) { setPseudoConfirmed(true); setInBossEvent(true); } }}
          isBossEvent
        />
      );
    }

    if (inBossEvent || pseudoConfirmed) {
      if (!inBossEvent) setInBossEvent(true);

      // ── AUTO-ROUTING par joueur — pas de phase globale ──
      // Chaque joueur avance selon son propre progress Firestore

      if (progress.loading) {
        return <LoadingScreen pseudo={pseudo} />;
      }

      // ÉTAPE 1 — QUIZ
      if (!progress.quizPassed) {
        return (
          <QuizScreen pseudo={pseudo} onComplete={() => {
            // submitQuizResult est appelé dans QuizScreen après le dialogue
          }} />
        );
      }

      // ÉTAPE 2 — 3v3 LÉGENDAIRES
      if (!progress.beastsPassed) {
        if (!player) return <LoadingScreen pseudo={pseudo} />;
        return (
          <BeastsBattle pseudo={pseudo} player={player} onComplete={(passed) => {
            if (!passed) {
              resetBossProgress().then(() => {
                setInBossEvent(false);
                setPseudoConfirmed(false);
                setPseudo("");
              });
            }
          }} />
        );
      }

      // ÉTAPE 3 — HO-OH BOSS FINAL
      if (!player) return <LoadingScreen pseudo={pseudo} />;
      return (
        <HoOhBattle pseudo={pseudo} player={player} onComplete={(won) => {
          if (won) {
            setShowCredits(true);
          } else {
            setInBossEvent(false);
            setPseudoConfirmed(false);
            setPseudo("");
            setPhase("intro");
          }
        }} />
      );
    }
  }

  // ═══════════════════════════════════════════════
  // NORMAL EVENTS (Suicune/Entei/Raikou)
  // ═══════════════════════════════════════════════

  // Block check for 3D modes
  if (event.active && !check.loading && check.blocked && cfg.renderMode !== "2d-battle") {
    return <BlockedScreen cfg={cfg} hasWon={check.hasWon} />;
  }

  // Pseudo input
  if (event.active && !pseudoConfirmed && !inRaikouBattle) {
    return <PseudoScreen pseudo={pseudo} setPseudo={setPseudo} cfg={cfg} onConfirm={() => { if (pseudo.trim().length >= 2) setPseudoConfirmed(true); }} />;
  }

  // Raikou 2D battle
  if ((event.active || inRaikouBattle) && pseudoConfirmed && cfg.renderMode === "2d-battle") {
    if (!inRaikouBattle) setInRaikouBattle(true);
    return (
      <RaikouBattle pseudo={pseudo} onComplete={() => {
        setInRaikouBattle(false); setPseudoConfirmed(false); setPseudo(""); setPhase("intro");
      }} />
    );
  }

  // 3D encounter (Suicune/Entei)
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <div className="absolute inset-0">
        <Scene phase={phase === "exhausted" ? "idle" : phase} onIntroDone={onIntroDone} onBallHit={onBallHit} pokemon={event.pokemon} />
      </div>
      <div className="relative z-10 pointer-events-none">
        <TopBar event={event} attempts={attempts} pseudo={pseudo} attemptsRemaining={attemptsRemaining} cfg={cfg} />
      </div>
      <div className="fixed bottom-28 right-5 z-10 pointer-events-none">
        <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF" className="w-14 sm:w-18 opacity-60" style={{ filter: "drop-shadow(0 0 8px rgba(0,0,0,0.6))" }} />
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

/* ═══════════════════════════════════════════════
   WAITING SCREEN — for boss event between phases
   ═══════════════════════════════════════════════ */

function LoadingScreen({ pseudo }: { pseudo: string }) {
  return (
    <div className="h-dvh w-full flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #1a0800, #0a0400)", fontFamily: "'Courier New', monospace" }}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-amber-300/60 text-sm">Chargement de l'équipe de {pseudo}…</p>
      </div>
    </div>
  );
}

function WaitingScreen({ title, subtitle, color, pseudo, blocked }: {
  title: string; subtitle: string; color: string; pseudo: string; blocked?: boolean;
}) {
  return (
    <div className="h-dvh w-full flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #2d1208 0%, #0a0400 100%)", fontFamily: "'Courier New', monospace" }}
    >
      <SacredFireBG />
      <div className="bg-[#f8f0e0] border-4 border-black p-6 max-w-sm text-center relative z-10" style={{ boxShadow: "6px 6px 0 #000" }}>
        <div className="text-3xl mb-3">{blocked ? "🚫" : "⏳"}</div>
        <h2 className="text-xl font-bold mb-3" style={{ color }}>{title}</h2>
        <p className="text-sm text-gray-700 mb-4">{subtitle}</p>
        {!blocked && (
          <div className="flex justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-amber-400/50 animate-pulse" style={{ animationDelay: "0.3s" }} />
            <div className="w-2 h-2 rounded-full bg-amber-400/30 animate-pulse" style={{ animationDelay: "0.6s" }} />
          </div>
        )}
        <p className="text-[10px] text-gray-400 mt-4">{pseudo}</p>
      </div>
    </div>
  );
}

function SacredFireBG() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="absolute rounded-full" style={{
          left: `${Math.random() * 100}%`, bottom: "-3%",
          width: 3, height: 3, backgroundColor: ["#f59e0b", "#ef4444", "#fbbf24"][i % 3],
          opacity: 0.2, animation: `fire-bg ${6 + Math.random() * 5}s ${Math.random() * 4}s infinite linear`,
        }} />
      ))}
      <style>{`@keyframes fire-bg { 0%{transform:translateY(0);opacity:0} 10%{opacity:.4} 100%{transform:translateY(-100vh);opacity:0} }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SUB-COMPONENTS (mostly from original, minor updates)
   ═══════════════════════════════════════════════ */

function PseudoScreen({ pseudo, setPseudo, onConfirm, cfg, isBossEvent }: {
  pseudo: string; setPseudo: (v: string) => void; onConfirm: () => void;
  cfg: ReturnType<typeof getPokemonConfig>; isBossEvent?: boolean;
}) {
  const valid = pseudo.trim().length >= 2;
  const isFireType = cfg.name === "entei";
  const isElectricType = cfg.name === "raikou";
  const isBoss = isBossEvent || cfg.name === "ho-oh";

  /* ══════════════════════════════════════════════
     BOSS EVENT — Écran d'accueil épique Ho-Oh
     ══════════════════════════════════════════════ */
  if (isBoss) {
    const HOOH = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/250.gif";
    const RAINBOW = ["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"];
    return (
      <div className="h-dvh w-full overflow-hidden relative flex flex-col"
        style={{ background: "linear-gradient(180deg,#030100 0%,#0d0500 20%,#180700 55%,#0a0400 100%)" }}>

        {/* Fire particles */}
        <SacredFireBG />

        {/* Rainbow light beams */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {RAINBOW.map((c, i) => (
            <div key={i} className="absolute top-0"
              style={{
                left: `${7 + i * 13}%`, width: "3px", height: "40%",
                background: `linear-gradient(180deg,${c}00,${c}25,${c}00)`,
                filter: "blur(3px)",
                transform: `rotate(${-10 + i * 3.5}deg)`,
                transformOrigin: "top center",
                animation: `beam-ps ${3.5 + i * 0.4}s ${i * 0.2}s ease-in-out infinite`,
              }} />
          ))}
        </div>

        {/* Top golden glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ width: "800px", height: "380px", background: "radial-gradient(ellipse,rgba(245,158,11,0.10),transparent 60%)", filter: "blur(50px)" }} />

        {/* ── Tout centré verticalement ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-6 relative z-10">

          {/* LIVE badge */}
          <motion.div initial={{ opacity:0, y:-15 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
            className="flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full"
            style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.22)" }}>
            <motion.span animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.2, repeat:Infinity }}
              className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span className="text-[10px] font-black text-red-400 tracking-[0.35em] uppercase">Événement en cours</span>
          </motion.div>

          {/* Ho-Oh sprite */}
          <motion.div className="relative mb-3"
            animate={{ y:[0,-14,0] }} transition={{ duration:4.5, repeat:Infinity, ease:"easeInOut" }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
              style={{ width:"280px", height:"280px", background:"radial-gradient(circle,rgba(245,158,11,0.14),transparent 65%)", filter:"blur(30px)", animation:"aura-ps 4s ease-in-out infinite" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
              style={{ width:"140px", height:"140px", background:"radial-gradient(circle,rgba(239,68,68,0.18),transparent 70%)", filter:"blur(20px)", animation:"aura-ps 2.8s 0.5s ease-in-out infinite reverse" }} />
            <img src={HOOH} alt="Ho-Oh"
              style={{
                imageRendering:"pixelated", width:"min(180px,36vw)", position:"relative",
                filter:"drop-shadow(0 0 35px rgba(245,158,11,0.80)) drop-shadow(0 0 70px rgba(220,38,38,0.25)) brightness(1.15)",
              }}
              onError={e => { (e.currentTarget as HTMLImageElement).src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/250.png"; }} />
          </motion.div>

          {/* RPPLF logo */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.25 }} className="mb-2">
            <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF"
              style={{ width:"36px", opacity:0.28, filter:"sepia(1) saturate(3) hue-rotate(20deg)" }} />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity:0, scale:0.88 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.4, duration:0.7 }}
            className="text-center font-black leading-none px-4 mb-3"
            style={{
              fontSize:"clamp(30px,7.5vw,56px)",
              background:"linear-gradient(140deg,#fef9c3 0%,#fde68a 20%,#fbbf24 40%,#f59e0b 58%,#ef4444 78%,#7f1d1d 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
              letterSpacing:"-0.025em",
            }}>
            La Quête de Ho-Oh
          </motion.h1>

          {/* Divider */}
          <motion.div initial={{ scaleX:0 }} animate={{ scaleX:1 }} transition={{ delay:0.65, duration:0.5 }}
            className="w-28 h-px mb-4"
            style={{ background:"linear-gradient(90deg,transparent,rgba(245,158,11,0.45),transparent)" }} />

          {/* Steps */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.8 }}
            className="flex items-center gap-2 mb-7">
            {[["📜","Quiz","#6366f1"],["⚔️","3v3","#f59e0b"],["🌈","Ho-Oh","#ef4444"]].map(([icon,label,color],i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{ background:`${color}12`, border:`1px solid ${color}30` }}>
                  <span className="text-[11px]">{icon}</span>
                  <span className="text-[9px] font-black tracking-wide" style={{ color }}>{label}</span>
                </div>
                {i < 2 && <span style={{ color:"rgba(245,158,11,0.2)", fontSize:"8px" }}>▶</span>}
              </div>
            ))}
          </motion.div>

          {/* Input card */}
          <motion.div
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.35, duration:0.6 }}
            className="w-full max-w-xs">
            <div className="rounded-2xl overflow-hidden"
              style={{
                background:"rgba(8,3,0,0.82)",
                border:"1px solid rgba(245,158,11,0.18)",
                backdropFilter:"blur(24px)",
                boxShadow:"0 0 80px rgba(245,158,11,0.07),0 20px 60px rgba(0,0,0,0.6),inset 0 1px 0 rgba(245,158,11,0.10)",
              }}>
              <div className="px-5 pt-5 pb-4">
                <label className="block text-[10px] font-black mb-2.5 tracking-[0.35em] uppercase text-center"
                  style={{ color:"rgba(245,158,11,0.45)" }}>
                  Ton Pseudo Dresseur
                </label>
                <input
                  type="text" value={pseudo}
                  onChange={e => setPseudo(e.target.value.substring(0, 30))}
                  onKeyDown={e => e.key === "Enter" && valid && onConfirm()}
                  placeholder="Ex: Hasbi, Tchoupi" autoFocus
                  className="w-full px-4 py-3.5 rounded-xl text-sm font-bold text-center outline-none transition-all"
                  style={{
                    background:"rgba(255,255,255,0.04)",
                    border:`1px solid ${valid ? "rgba(245,158,11,0.35)" : "rgba(245,158,11,0.12)"}`,
                    color:"#fef3c7", caretColor:"#f59e0b",
                    boxShadow: valid ? "0 0 20px rgba(245,158,11,0.08)" : "none",
                  }} />
              </div>
              <div className="px-5 pb-5">
                <button onClick={onConfirm} disabled={!valid}
                  className="w-full py-4 rounded-xl text-sm font-black tracking-wider transition-all relative overflow-hidden disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{
                    background: valid ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "rgba(255,255,255,0.05)",
                    color: valid ? "#fff" : "rgba(255,255,255,0.25)",
                    boxShadow: valid ? "0 0 30px rgba(245,158,11,0.30),0 4px 16px rgba(0,0,0,0.5)" : "none",
                    letterSpacing:"0.08em",
                  }}>
                  ENTRER DANS LA TOUR ⚔️
                  {valid && (
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)", animation:"shimmer-ps 2.5s infinite" }} />
                  )}
                </button>
                <p className="text-center text-[9px] mt-3 tracking-widest" style={{ color:"rgba(255,255,255,0.10)" }}>
                  Quiz → 3v3 Légendaires → Boss Final Ho-Oh
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <style>{`
          @keyframes beam-ps  { 0%,100%{opacity:.2} 50%{opacity:.9} }
          @keyframes aura-ps  { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.6} 50%{transform:translate(-50%,-50%) scale(1.18);opacity:1} }
          @keyframes shimmer-ps { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        `}</style>
      </div>
    );
  }

  /* ── Événements normaux (Suicune / Entei / Raikou) — inchangés ── */
  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden" style={{
      background: isFireType ? "linear-gradient(180deg, #1a0808 0%, #0d0404 50%, #050810 100%)"
        : isElectricType ? "linear-gradient(180deg, #1a1408 0%, #0d0a04 50%, #050410 100%)"
        : undefined,
    }}>
      {isFireType && <FireEmbers />}
      {isElectricType && <><ElectricSparks /><LightningStrikes /></>}
      {!isFireType && !isElectricType && <div className="lobby-bg absolute inset-0" />}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ background: `${cfg.accentColorHex}08` }} />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative w-full max-w-sm z-10">
        <div className="flex justify-center mb-6">
          <span className="event-badge event-badge-live"><span className="live-dot" />Événement en cours</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-2 text-white" style={{ fontFamily: "var(--font-display)" }}>
          Qui es-tu, dresseur ?
        </h1>
        <p className="text-sm text-white/40 mb-8">Entre ton pseudo pour affronter {cfg.displayName}</p>
        <div className="mb-6">
          <input type="text" value={pseudo} onChange={(e) => setPseudo(e.target.value.substring(0, 30))}
            onKeyDown={(e) => e.key === "Enter" && valid && onConfirm()}
            placeholder="Ton pseudo..." autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-lg text-center font-semibold outline-none focus:border-cyan-400/40 transition-all placeholder:text-white/20" />
          <p className="text-xs text-white/20 mt-2">
            {isElectricType ? "4 badges requis" : "3 essais par événement"}
          </p>
        </div>
        <button onClick={onConfirm} disabled={!valid} className="btn-throw w-full text-lg py-4 disabled:opacity-30">
          Entrer dans l'arène
        </button>
        <div className="mt-8 flex justify-center">
          <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF" className="w-20 opacity-40" />
        </div>
      </motion.div>
    </div>
  );
}

function BlockedScreen({ cfg, hasWon }: { cfg: ReturnType<typeof getPokemonConfig>; hasWon: boolean }) {
  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="lobby-bg absolute inset-0" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-sm text-center">
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{
          background: hasWon ? "linear-gradient(135deg, rgba(250,204,21,.15), rgba(245,158,11,.08))" : "rgba(100,116,139,.1)",
          border: hasWon ? "1px solid rgba(250,204,21,.25)" : "1px solid rgba(100,116,139,.15)",
        }}><span className="text-3xl">{hasWon ? "✦" : "✕"}</span></div>
        <h1 className="text-2xl font-black mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
          {hasWon ? "Déjà capturé !" : "Plus d'essais"}
        </h1>
        <p className="text-sm text-white/40 mb-4">
          {hasWon ? `Vous avez déjà capturé ${cfg.displayName}.` : `Vos 3 essais sont épuisés.`}
        </p>
      </motion.div>
    </div>
  );
}

function LobbyScreen({ pokemon, isBossEvent }: { pokemon: string; isBossEvent?: boolean }) {
  const cfg = getPokemonConfig(pokemon);
  const isFireType = cfg.name === "entei";
  const isElectricType = cfg.name === "raikou";
  const isBoss = isBossEvent || cfg.name === "ho-oh";

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden" style={{
      background: isBoss ? "linear-gradient(180deg, #2d1208 0%, #1a0800 50%, #0a0400 100%)"
        : isFireType ? "linear-gradient(180deg, #1a0808 0%, #0d0404 50%, #050810 100%)"
        : isElectricType ? "linear-gradient(180deg, #1a1408 0%, #0d0a04 50%, #050410 100%)"
        : undefined,
    }}>
      {isBoss && <SacredFireBG />}
      {isFireType && !isBoss && <FireEmbers />}
      {isElectricType && <><ElectricSparks /><LightningStrikes /></>}
      {!isFireType && !isElectricType && !isBoss && <div className="lobby-bg absolute inset-0" />}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ background: `${cfg.accentColorHex}08` }} />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative z-10">
        <div className="flex justify-center mb-6">
          <span className="event-badge event-badge-offline"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Hors ligne</span>
        </div>
        <h1 className="text-5xl sm:text-7xl mb-4 font-black" style={{ fontFamily: "var(--font-display)", background: cfg.titleGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {isBoss ? "HO-OH" : cfg.displayName.toUpperCase()}
        </h1>
        <p className="text-lg sm:text-xl font-medium mb-2" style={{ color: `${cfg.accentColorHex}60` }}>
          {isBoss ? "Boss Event — Finale Saison 2G" : isElectricType ? "Battle Event" : "Encounter Event"}
        </p>
        <div className="w-16 h-px mx-auto my-8" style={{ background: `linear-gradient(to right, transparent, ${cfg.accentColorHex}40, transparent)` }} />
        <p className="text-sm text-white/40 max-w-md mx-auto leading-relaxed mb-3">
          {isBoss ? (
            <>L'événement n'est pas actif. Quand il sera lancé : <strong className="text-white/60">Quiz Kimono</strong> → <strong className="text-white/60">Combat 3v3 vs Trio</strong> → <strong className="text-white/60">Boss Ho-Oh Niv.150</strong></>
          ) : isElectricType ? (
            <>Affrontez <strong className="text-white/60">RAIKOU</strong> avec votre équipe ! <strong className="text-white/60">4 badges</strong> requis.</>
          ) : (
            <><strong className="text-white/60">10 minutes</strong> et <strong className="text-white/60">3 essais</strong> pour capturer {cfg.displayName}.</>
          )}
        </p>
        <div className="mt-10 flex justify-center">
          <img src={`${BASE_PATH}/textures/logo.png`} alt="RPPLF" className="w-28 sm:w-36 object-contain" style={{ filter: `drop-shadow(0 0 20px ${cfg.accentColorHex}20)` }} />
        </div>
      </motion.div>
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-white/15 tracking-widest uppercase">RPPLF</p>
      </div>
    </div>
  );
}

function TopBar({ event, attempts, pseudo, attemptsRemaining, cfg }: {
  event: ReturnType<typeof useEvent>; attempts: number; pseudo: string; attemptsRemaining: number; cfg: ReturnType<typeof getPokemonConfig>;
}) {
  const isUrgent = event.remaining < 60 && event.remaining > 0;
  return (
    <div className="flex items-start justify-between p-4 sm:p-5">
      <div className="hud-panel-sm px-4 py-3 flex items-center gap-3 pointer-events-auto">
        {event.active ? (<>
          <span className="event-badge event-badge-live" style={{ padding: "4px 10px", fontSize: 11 }}><span className="live-dot" />Live</span>
          <div className={`timer-digit text-xl font-bold ${isUrgent ? "text-red-400" : "text-white"}`} style={isUrgent ? { animation: "countdown-pulse 0.8s infinite" } : undefined}>{event.display}</div>
        </>) : (<span className="text-xs text-white/40">Chargement…</span>)}
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

function EncounterHUD({ phase, message, canThrow, onThrow, showResult, attemptsRemaining, cfg }: {
  phase: Phase; message: string; canThrow: boolean; onThrow: () => void; showResult: boolean; attemptsRemaining: number; cfg: ReturnType<typeof getPokemonConfig>;
}) {
  if (showResult) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="hud-panel p-4 sm:p-5 pointer-events-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${cfg.accentColorHex}90` }}>Rencontre</span>
          </div>
          <AnimatePresence mode="popLayout">
            <motion.p key={message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-base sm:text-lg font-bold text-white truncate">{message}</motion.p>
          </AnimatePresence>
          <p className="text-xs text-white/30 mt-1">
            Taux: <span className="font-mono font-semibold" style={{ color: `${cfg.accentColorHex}80` }}>0.2%</span>
            <span className="text-white/15 mx-2">·</span>
            <span className={attemptsRemaining <= 1 ? "text-red-400/60" : "text-white/30"}>{attemptsRemaining} essai{attemptsRemaining > 1 ? "s" : ""}</span>
          </p>
        </div>
        <button onClick={onThrow} disabled={!canThrow} className="btn-throw"><span className="flex items-center gap-2"><span className="pokeball-icon" />Lancer</span></button>
      </div>
    </motion.div>
  );
}

function ResultOverlay({ phase, onReset, pseudo, cfg }: { phase: Phase; onReset: () => void; pseudo: string; cfg: ReturnType<typeof getPokemonConfig> }) {
  const captured = phase === "captured";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="result-overlay">
      <div className="absolute inset-0" style={{ background: captured ? "radial-gradient(ellipse at center, rgba(250,204,21,.12) 0%, rgba(0,0,0,.6) 70%)" : "radial-gradient(ellipse at center, rgba(100,116,139,.08) 0%, rgba(0,0,0,.6) 70%)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="result-card hud-panel relative">
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-display)", color: captured ? "#fbbf24" : "#94a3b8" }}>
          {captured ? "Capturé !" : "Échappé…"}
        </h2>
        <p className="text-sm text-white/50 mb-6">{captured ? `Bravo ${pseudo} !` : `${cfg.displayName} s'est enfui.`}</p>
        {captured && <button onClick={onReset} className="btn-secondary pointer-events-auto">Fermer</button>}
      </motion.div>
    </motion.div>
  );
}

/* Effect components from original */
function FireEmbers() {
  const embers = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 5, duration: 4 + Math.random() * 6,
    size: 2 + Math.random() * 4, opacity: 0.3 + Math.random() * 0.5, color: Math.random() > 0.5 ? "#f97316" : "#fbbf24",
  })), []);
  return (<div className="absolute inset-0 pointer-events-none overflow-hidden">
    {embers.map((e) => (<div key={e.id} className="absolute rounded-full" style={{
      left: `${e.left}%`, bottom: "-5%", width: e.size, height: e.size, backgroundColor: e.color,
      boxShadow: `0 0 ${e.size * 2}px ${e.color}`, opacity: e.opacity,
      animation: `ember-rise ${e.duration}s ${e.delay}s infinite linear`,
    }} />))}
    <style>{`@keyframes ember-rise { 0%{transform:translateY(0);opacity:0} 10%{opacity:.6} 100%{transform:translateY(-100vh) translateX(30px);opacity:0} }`}</style>
  </div>);
}

function ElectricSparks() {
  const sparks = useMemo(() => Array.from({ length: 35 }, (_, i) => ({
    id: i, left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 4,
    duration: 2 + Math.random() * 4, size: 1.5 + Math.random() * 3,
    color: Math.random() > 0.6 ? "#fbbf24" : "#a855f7",
  })), []);
  return (<div className="absolute inset-0 pointer-events-none overflow-hidden">
    {sparks.map((s) => (<div key={s.id} className="absolute rounded-full" style={{
      left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, backgroundColor: s.color,
      boxShadow: `0 0 ${s.size * 3}px ${s.color}`, animation: `electric-pulse ${s.duration}s ${s.delay}s infinite ease-in-out`,
    }} />))}
    <style>{`@keyframes electric-pulse { 0%,100%{transform:scale(.8);opacity:.2} 50%{transform:scale(1.4);opacity:1} }`}</style>
  </div>);
}

function LightningStrikes() {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const trigger = () => { setFlash(true); setTimeout(() => setFlash(false), 150); };
    const schedule = () => { const t = setTimeout(() => { trigger(); schedule(); }, 8000 + Math.random() * 12000); return t; };
    const t = schedule(); return () => clearTimeout(t);
  }, []);
  return (<div className="absolute inset-0 pointer-events-none transition-opacity" style={{
    background: flash ? "radial-gradient(ellipse at 50% 0%, rgba(253,224,71,.15), transparent 60%)" : "transparent",
    opacity: flash ? 1 : 0, transitionDuration: flash ? "20ms" : "300ms",
  }} />);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }