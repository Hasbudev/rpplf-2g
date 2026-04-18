"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchPokemonData, type PokemonData } from "../lib/pokeApi";
import {
  calculateDamage, calculateMaxHP, getEffectiveness, pickMovesForPokemon,
  canMoveWithParalysis, burnDamage, poisonDamage,
  TYPE_COLORS, HOOH_LEVEL, HOOH_MAX_HP, HOOH_TYPES,
  getBossPhase, getHoOhMoves, calculateBossCaptureRate, getBossDamageMultiplier,
  PHASE_NAMES, PHASE_COLORS,
  type Move, type PokemonType, type StatusState, type BossPhase,
} from "../lib/battleSystem";
import { updateLiveBattle } from "../hooks/useEvent";
import type { Player, PlayerPokemon } from "../lib/playerRoster";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MAX_POKEBALLS = 3;
const AURORE_MAX = 2;

type Phase = "team_select" | "battle" | "switch_pokemon" | "victory" | "defeat" | "fled";

interface TeamMember {
  pokemon: PlayerPokemon; data: PokemonData;
  currentHP: number; maxHP: number; fainted: boolean;
  moves: Move[]; status: StatusState;
}

interface BState {
  hp: number; maxHP: number; status: StatusState;
  bossPhase: BossPhase; pokeballsLeft: number; auroreLeft: number;
  log: string[]; busy: boolean;
}

export function HoOhBattle({
  pseudo, player, onComplete,
}: {
  pseudo: string;
  player: Player;
  onComplete: (won: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("team_select");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const teamRef = useRef<TeamMember[]>([]);
  useEffect(() => { teamRef.current = team; }, [team]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [battle, setBattle] = useState<BState>({
    hp: HOOH_MAX_HP, maxHP: HOOH_MAX_HP, status: { status: null },
    bossPhase: "sacred", pokeballsLeft: MAX_POKEBALLS, auroreLeft: AURORE_MAX,
    log: [], busy: false,
  });
  const [menuMode, setMenuMode] = useState<"main" | "moves">("main");
  const [ballAnim, setBallAnim] = useState<"idle" | "throwing" | "shaking" | "success" | "fail">("idle");
  const [phaseFlash, setPhaseFlash] = useState<BossPhase | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const play = (phase === "battle" || phase === "switch_pokemon") && musicEnabled;
    if (play) { a.volume = 0.3; a.loop = true; a.play().catch(() => {}); } else a.pause();
  }, [phase, musicEnabled]);

  // Load team (use existing HP from beasts fight — NO reset, they come in battered)
  useEffect(() => {
    (async () => {
      const td: TeamMember[] = [];
      for (const p of player.team) {
        const data = await fetchPokemonData(p.name);
        if (data) {
          const maxHP = calculateMaxHP(p.level, data.baseHP);
          td.push({ pokemon: p, data, currentHP: maxHP, maxHP, fainted: false, moves: pickMovesForPokemon(data.types), status: { status: null } });
        }
      }
      setTeam(td);
    })();
  }, [player]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const startBattle = useCallback((idx: number) => {
    setActiveIdx(idx);
    setBattle({
      hp: HOOH_MAX_HP, maxHP: HOOH_MAX_HP, status: { status: null },
      bossPhase: "sacred", pokeballsLeft: MAX_POKEBALLS, auroreLeft: AURORE_MAX,
      log: ["Le ciel s'embrasse d'un arc-en-ciel sacré…", "HO-OH apparaît dans un torrent de flammes !"],
      busy: false,
    });
    setPhase("battle");
    setMenuMode("main");
    updateLiveBattle({
      pseudo, pokemon: "ho-oh", currentPokemon: team[idx].pokemon.name,
      currentPokemonHP: team[idx].currentHP, currentPokemonMaxHP: team[idx].maxHP,
      raikouHP: HOOH_MAX_HP, raikouMaxHP: HOOH_MAX_HP, pokeballsLeft: MAX_POKEBALLS,
      battlePhase: "hooh", bossPhase: "sacred", status: "in_battle",
      lastAction: "Combat commencé", log: ["HO-OH apparaît !"],
    });
  }, [team, pseudo]);

  const switchPoke = useCallback((idx: number) => {
    setActiveIdx(idx);
    setBattle((b) => ({ ...b, log: [`Allez ${team[idx].pokemon.name.toUpperCase()} !`, "Que voulez-vous faire ?"], busy: false }));
    setPhase("battle"); setMenuMode("main");
  }, [team]);

  /* Ho-Oh AI */
  const pickMove = useCallback((opp: TeamMember, st: BState): Move => {
    const moves = getHoOhMoves(st.bossPhase);
    const hpPct = st.hp / st.maxHP;
    if (hpPct < 0.30 && st.auroreLeft > 0 && Math.random() < 0.55) {
      const a = moves.find((m) => m.name === "Aurore");
      if (a) return a;
    }
    const dmg = moves.filter((m) => m.power > 0);
    const scored = dmg.map((m) => ({
      move: m, score: m.power * getEffectiveness(m.type, opp.data.types) * (HOOH_TYPES.includes(m.type) ? 1.5 : 1),
    })).sort((a, b) => b.score - a.score);
    return st.bossPhase === "sacred" && Math.random() < 0.3 ? dmg[Math.floor(Math.random() * dmg.length)] : scored[0]?.move || dmg[0];
  }, []);

  const hoohAttack = useCallback(async (active: TeamMember, chain: boolean): Promise<boolean> => {
    if (battle.status.status === "paralysis" && !canMoveWithParalysis()) {
      setBattle((b) => ({ ...b, log: ["HO-OH est paralysé !"] }));
      await sleep(1200);
      if (!chain) setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      return false;
    }

    const move = pickMove(active, battle);
    if (move.name === "Aurore") {
      const heal = Math.floor(battle.maxHP * 0.33);
      const newHP = Math.min(battle.maxHP, battle.hp + heal);
      setBattle((b) => ({
        ...b, hp: newHP, auroreLeft: b.auroreLeft - 1, bossPhase: getBossPhase(newHP / b.maxHP),
        log: ["HO-OH utilise Aurore !", `HO-OH récupère ${heal} PV !`],
      }));
      await sleep(1500);
      if (!chain) setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      return false;
    }

    const eff = getEffectiveness(move.type, active.data.types);
    const stab = HOOH_TYPES.includes(move.type);
    const mult = getBossDamageMultiplier(battle.bossPhase);
    const damage = Math.floor(calculateDamage(HOOH_LEVEL, move.power, eff, stab) * mult);
    setBattle((b) => ({ ...b, log: [`HO-OH utilise ${move.name} !`] }));
    await sleep(900);

    if (eff === 0) {
      setBattle((b) => ({ ...b, log: [...b.log, `Ça n'affecte pas ${active.pokemon.name.toUpperCase()} !`] }));
      await sleep(1100);
      if (!chain) setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      return false;
    }

    const effMsg = eff > 1 ? " C'est super efficace !" : eff < 1 ? " Pas très efficace…" : "";
    const newHP = Math.max(0, active.currentHP - damage);
    setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
    setBattle((b) => ({ ...b, log: [...b.log, `${damage} dégâts !${effMsg}`] }));
    await sleep(1100);

    if (move.effect && move.effectChance && Math.random() < move.effectChance && active.status.status === null) {
      if (!(move.effect === "burn" && active.data.types.includes("Feu"))) {
        setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, status: { status: move.effect! } } : m));
        setBattle((b) => ({ ...b, log: [...b.log, `${active.pokemon.name.toUpperCase()} est ${move.effect === "burn" ? "brûlé" : move.effect} !`] }));
        await sleep(1200);
      }
    }

    if (newHP <= 0) {
      setBattle((b) => ({ ...b, log: [...b.log, `${active.pokemon.name.toUpperCase()} est K.O. !`] }));
      await sleep(1500);
      const alive = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted);
      if (alive.length === 0) {
        setBattle((b) => ({ ...b, busy: false }));
        updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "defeat", battlePhase: "hooh", lastAction: "Équipe K.O." });
        await sleep(2000);
        setPhase("defeat"); return true;
      }
      setBattle((b) => ({ ...b, busy: false }));
      setPhase("switch_pokemon"); return true;
    }
    if (!chain) setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
    return false;
  }, [battle, activeIdx, pseudo, pickMove]);

  const playerAttack = useCallback(async (mi: number) => {
    const active = teamRef.current[activeIdx];
    if (!active || battle.busy) return;
    setBattle((b) => ({ ...b, busy: true })); setMenuMode("main");

    const ko = await hoohAttack(active, true);
    if (ko) return;
    const after = teamRef.current[activeIdx];
    if (!after || after.fainted) return;

    if (after.status.status === "paralysis" && !canMoveWithParalysis()) {
      setBattle((b) => ({ ...b, log: [...b.log, `${after.pokemon.name.toUpperCase()} est paralysé !`], busy: false }));
      await sleep(1400);
      setBattle((b) => ({ ...b, log: [...b.log, "Que voulez-vous faire ?"] }));
      return;
    }

    const move = after.moves[mi];
    const stab = after.data.types.includes(move.type);
    const eff = getEffectiveness(move.type, HOOH_TYPES);
    const damage = calculateDamage(after.pokemon.level, move.power, eff, stab);
    setBattle((b) => ({ ...b, log: [...b.log, `${after.pokemon.name.toUpperCase()} utilise ${move.name} !`] }));
    await sleep(900);

    if (eff === 0) {
      setBattle((b) => ({ ...b, log: [...b.log, "Ça n'affecte pas HO-OH !"], busy: false }));
      await sleep(1100);
      return;
    }

    const effMsg = eff > 1 ? " C'est super efficace !" : eff < 1 ? " Pas très efficace…" : "";
    const newHP = Math.max(0, battle.hp - damage);
    const newPhase = getBossPhase(newHP / battle.maxHP);
    const prevPhase = battle.bossPhase;

    setBattle((b) => ({ ...b, hp: newHP, bossPhase: newPhase, log: [...b.log, `${damage} dégâts !${effMsg}`] }));
    updateLiveBattle({
      pseudo, pokemon: "ho-oh", currentPokemon: after.pokemon.name,
      currentPokemonHP: after.currentHP, currentPokemonMaxHP: after.maxHP,
      raikouHP: newHP, raikouMaxHP: HOOH_MAX_HP, pokeballsLeft: battle.pokeballsLeft,
      battlePhase: "hooh", bossPhase: newPhase, status: "in_battle",
      lastAction: `${after.pokemon.name} → ${move.name} (${damage})`,
      log: [`${after.pokemon.name} → ${move.name}: ${damage} dégâts`],
    });
    await sleep(1100);

    if (newPhase !== prevPhase && newHP > 0) {
      setPhaseFlash(newPhase);
      setBattle((b) => ({ ...b, log: [...b.log, newPhase === "rage" ? "HO-OH entre en RAGE !" : "HO-OH atteint sa forme DIVINE !"] }));
      await sleep(3000);
      setPhaseFlash(null);
    }

    if (newHP <= 0) {
      setBattle((b) => ({ ...b, busy: false }));
      updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "fled", battlePhase: "hooh", lastAction: "Ho-Oh K.O." });
      await sleep(2200);
      setPhase("fled"); return;
    }

    // Burn on player end of turn
    const cur = teamRef.current[activeIdx];
    if (cur && !cur.fainted && cur.status.status === "burn") {
      const d = burnDamage(cur.maxHP);
      const h = Math.max(0, cur.currentHP - d);
      setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: h, fainted: h <= 0 } : m));
      setBattle((b) => ({ ...b, log: [...b.log, `Brûlure ! -${d} PV`] }));
      await sleep(900);
      if (h <= 0) {
        const alive = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted);
        if (alive.length === 0) { setPhase("defeat"); return; }
        setBattle((b) => ({ ...b, busy: false })); setPhase("switch_pokemon"); return;
      }
    }

    setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
  }, [activeIdx, battle, hoohAttack, pseudo]);

  const throwBall = useCallback(async () => {
    const active = teamRef.current[activeIdx];
    if (!active || battle.busy || battle.pokeballsLeft <= 0) return;
    setBattle((b) => ({ ...b, busy: true, pokeballsLeft: b.pokeballsLeft - 1, log: ["Vous lancez une POKÉBALL !"] }));
    setBallAnim("throwing"); await sleep(900);
    setBallAnim("shaking"); setBattle((b) => ({ ...b, log: [...b.log, "La Pokéball tremble…"] })); await sleep(2400);

    const capRate = calculateBossCaptureRate(battle.hp / battle.maxHP);
    if (Math.random() < capRate) {
      setBallAnim("success");
      setBattle((b) => ({ ...b, log: [...b.log, "HO-OH A ÉTÉ CAPTURÉ !!!"] }));
      updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "victory", battlePhase: "hooh", lastAction: "HO-OH CAPTURÉ !" });
      await sleep(2400);
      setPhase("victory"); return;
    }

    setBallAnim("fail");
    setBattle((b) => ({ ...b, log: [...b.log, "HO-OH brise la Pokéball !"] }));
    await sleep(1500); setBallAnim("idle");

    if (battle.pokeballsLeft - 1 <= 0) {
      updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "defeat", battlePhase: "hooh", lastAction: "Plus de Pokéballs" });
      await sleep(2000); setPhase("defeat"); return;
    }

    await hoohAttack(active, false);
  }, [activeIdx, battle, hoohAttack, pseudo]);

  /* ─── RENDER ─── */
  const audioEl = <audio ref={audioRef} src={`${BASE_PATH}/audio/hooh-theme.mp3`} preload="auto" />;

  if (phase === "team_select") return <>{audioEl}<TeamSelect team={team} onSelect={startBattle} pseudo={pseudo} musicEnabled={musicEnabled} setMusicEnabled={setMusicEnabled} /></>;
  if (phase === "switch_pokemon") return <>{audioEl}<SwitchSelect team={team} onSelect={switchPoke} /></>;
  if (phase === "victory") return <>{audioEl}<ResultScreen type="victory" pseudo={pseudo} onClose={() => onComplete(true)} /></>;
  if (phase === "defeat") return <>{audioEl}<ResultScreen type="defeat" pseudo={pseudo} onClose={() => onComplete(false)} /></>;
  if (phase === "fled") return <>{audioEl}<ResultScreen type="fled" pseudo={pseudo} onClose={() => onComplete(false)} /></>;

  const active = team[activeIdx];
  if (!active) return null;
  const bp = battle.bossPhase;
  const pc = PHASE_COLORS[bp];
  const hpPct = (battle.hp / battle.maxHP) * 100;
  const pHpPct = (active.currentHP / active.maxHP) * 100;
  const capRate = (calculateBossCaptureRate(hpPct / 100) * 100).toFixed(1);
  const hpCol = (p: number) => p > 50 ? "#22c55e" : p > 20 ? "#f59e0b" : "#ef4444";
  const hidden = ballAnim === "throwing" || ballAnim === "shaking" || ballAnim === "success";
  const bgGrad = bp === "divine" ? "linear-gradient(180deg,#3d2800,#1a1000 50%,#2d1800)" : bp === "rage" ? "linear-gradient(180deg,#3d0400,#1a0400 50%,#2d0400)" : "linear-gradient(180deg,#2d1208,#1a0800 50%,#0a0400)";

  return (
    <>{audioEl}
    <div className="h-dvh w-full flex flex-col" style={{ fontFamily: "'Courier New', monospace", background: "#0a0400" }}>
      {/* Phase transition overlay */}
      <AnimatePresence>
        {phaseFlash && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 1.5 }} className="text-center">
              <div className="text-5xl mb-4">{phaseFlash === "rage" ? "🔥" : "✦"}</div>
              <h2 className="text-3xl font-black" style={{ color: PHASE_COLORS[phaseFlash].primary }}>{PHASE_NAMES[phaseFlash]}</h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arena */}
      <div className="relative flex-1 overflow-hidden" style={{ background: bgGrad, minHeight: "55%" }}>
        <FireParticles phase={bp} />
        {bp === "divine" && <RainbowOrbit />}

        {/* Ho-Oh info */}
        <div className="absolute top-3 left-3 z-20 bg-[#f8f0e0] border-[3px] p-2 px-3 max-w-[58%]"
          style={{ borderColor: bp === "divine" ? "#f59e0b" : bp === "rage" ? "#dc2626" : "#000", boxShadow: `4px 4px 0 #000${bp !== "sacred" ? `, 0 0 12px ${pc.glow}` : ""}` }}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[13px] font-bold" style={{ color: bp === "rage" ? "#dc2626" : bp === "divine" ? "#b45309" : "#000" }}>HO-OH</span>
            <span className="text-[8px] font-bold px-1 py-0.5" style={{ background: pc.primary, color: "#000" }}>{PHASE_NAMES[bp].toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="flex-1 h-2.5 bg-black border border-black" style={{ padding: "1px", minWidth: "90px" }}>
              <div style={{ width: `${hpPct}%`, height: "100%", background: hpCol(hpPct), transition: "width 0.5s", boxShadow: `0 0 4px ${hpCol(hpPct)}` }} />
            </div>
          </div>
          <span className="text-[9px] text-gray-700">Capture: <strong style={{ color: hpCol(hpPct) }}>{capRate}%</strong> · Niv. 150</span>
        </div>

        {/* Ho-Oh sprite */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          animate={hidden ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: bp === "divine" ? "280px" : "240px", height: bp === "divine" ? "280px" : "240px", borderRadius: "50%", background: `radial-gradient(circle, ${pc.glow}, transparent 70%)`, filter: "blur(25px)", animation: "auraPulse 2.5s ease-in-out infinite" }} />
          <img src="https://play.pokemonshowdown.com/sprites/ani/ho-oh.gif" alt="Ho-Oh"
            style={{ imageRendering: "pixelated", width: bp === "divine" ? "min(200px,40vw)" : "min(170px,35vw)", position: "relative", filter: `drop-shadow(0 0 20px ${pc.glow})`, animation: "hoohFloat 3s ease-in-out infinite" }}
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </motion.div>

        {/* Pokeball anim */}
        {ballAnim !== "idle" && (
          <div className="absolute z-30 pointer-events-none" style={{ top: "50%", left: "50%", width: "48px", height: "48px", transform: "translate(-50%,-50%)",
            animation: ballAnim === "throwing" ? "ballThrow .9s cubic-bezier(.4,0,.6,1) forwards" : ballAnim === "shaking" ? "ballShake .6s ease-in-out infinite" : ballAnim === "success" ? "ballCaptured 1.2s ease-out forwards" : "ballBreak 1.2s ease-out forwards",
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,.5))" }}>
              <circle cx="24" cy="24" r="22" fill="#fff" stroke="#000" strokeWidth="3"/><path d="M2 24A22 22 0 0146 24L2 24Z" fill="#ef4444" stroke="#000" strokeWidth="3"/><line x1="2" y1="24" x2="46" y2="24" stroke="#000" strokeWidth="3"/><circle cx="24" cy="24" r="6" fill="#fff" stroke="#000" strokeWidth="3"/><circle cx="24" cy="24" r="2.5" fill="#ccc"/>
            </svg>
          </div>
        )}

        {/* Player sprite */}
        <motion.div className="absolute z-10" style={{ bottom: "12%", left: "8%" }} animate={{ y: [0,-4,0] }} transition={{ duration: 2, repeat: Infinity }}>
          {active.data.spriteAnimated ? <img src={active.data.spriteAnimated} alt={active.pokemon.name} style={{ imageRendering: "pixelated", width: "min(120px,25vw)", transform: "scaleX(-1)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.4))" }} />
          : active.data.sprite ? <img src={active.data.sprite} alt={active.pokemon.name} style={{ width: "min(100px,22vw)", transform: "scaleX(-1)" }} /> : null}
        </motion.div>

        {/* Player info */}
        <div className="absolute bottom-3 right-3 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 z-20 max-w-[50%]" style={{ boxShadow: "4px 4px 0 #000" }}>
          <span className="text-[12px] font-bold text-black">{active.pokemon.name.toUpperCase()}</span>
          <span className="text-[10px] text-gray-600 ml-1">Niv.{active.pokemon.level}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="flex-1 h-2 bg-black border border-black" style={{ padding: "1px" }}>
              <div style={{ width: `${pHpPct}%`, height: "100%", background: hpCol(pHpPct), transition: "width .5s" }} />
            </div>
          </div>
          <div className="text-[9px] text-black font-bold mt-0.5">{active.currentHP}/{active.maxHP}</div>
        </div>

        {/* Music + balls */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          <button onClick={() => setMusicEnabled((m) => !m)} className="border-[3px] border-black bg-[#f8f0e0] px-2 py-1 text-sm font-bold" style={{ boxShadow: "3px 3px 0 #000" }}>{musicEnabled ? "🔊" : "🔇"}</button>
          <div className="flex items-center gap-1 bg-[#f8f0e0] border-[3px] border-black px-2 py-1" style={{ boxShadow: "3px 3px 0 #000" }}>
            {Array.from({ length: MAX_POKEBALLS }).map((_, i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i >= battle.pokeballsLeft ? "#ccc" : "linear-gradient(180deg,#ef4444 50%,#fff 50%)", border: "1.5px solid #000", opacity: i >= battle.pokeballsLeft ? 0.3 : 1 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Commands */}
      <div style={{ background: bp === "divine" ? "linear-gradient(180deg,#f8f0e0,#fef3c7)" : "#f8f0e0", borderTop: `4px solid ${bp === "divine" ? "#f59e0b" : bp === "rage" ? "#dc2626" : "#000"}`, minHeight: "200px", padding: "10px 12px 12px" }}>
        <div className="bg-white border-[3px] border-black p-3 mb-2.5 relative" style={{ boxShadow: "4px 4px 0 #000", minHeight: "50px" }}>
          <div className="absolute top-1 left-1 right-1 bottom-1 border border-gray-300 pointer-events-none" />
          {battle.log.slice(-2).map((l, i) => <p key={i} className="text-[13px] text-black font-bold" style={{ lineHeight: "1.5" }}>{l}</p>)}
        </div>

        {menuMode === "main" ? (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={battle.busy} onClick={() => setMenuMode("moves")}
              className="border-[3px] border-black p-3 text-sm font-bold disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ boxShadow: "4px 4px 0 #000", background: TYPE_COLORS[active.data.types[0] || "Normal"], color: "#000" }}>⚔️ ATTAQUE</button>
            <button disabled={battle.busy || battle.pokeballsLeft === 0} onClick={throwBall}
              className="border-[3px] border-black p-3 text-sm font-bold disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ boxShadow: "4px 4px 0 #000", background: "linear-gradient(180deg,#fef3c7,#f59e0b)", color: "#000" }}>🔥 CAPTURE ({battle.pokeballsLeft})</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {active.moves.map((m, i) => (
              <button key={i} disabled={battle.busy} onClick={() => playerAttack(i)}
                className="border-[3px] border-black p-2.5 text-left disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                style={{ boxShadow: "4px 4px 0 #000", background: TYPE_COLORS[m.type], color: "#000" }}>
                <div className="text-[12px] font-bold" style={{ textShadow: "1px 1px 0 rgba(255,255,255,.5)" }}>{m.name.toUpperCase()}</div>
                <div className="text-[10px] text-black/70 font-bold">{m.power === 0 ? "STATUT" : `PUI: ${m.power}`} · {m.type.toUpperCase()}</div>
              </button>
            ))}
            <button onClick={() => setMenuMode("main")} className="col-span-2 text-[11px] text-black font-bold underline mt-1">← Retour</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes hoohFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes auraPulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.7} 50%{transform:translate(-50%,-50%) scale(1.2);opacity:1} }
        @keyframes ballThrow { 0%{top:90%;left:15%;transform:translate(-50%,-50%) rotate(0) scale(.6)} 50%{top:20%;left:35%;transform:translate(-50%,-50%) rotate(360deg) scale(1.1)} 100%{top:50%;left:50%;transform:translate(-50%,-50%) rotate(720deg) scale(1)} }
        @keyframes ballShake { 0%,100%{transform:translate(-50%,-50%) rotate(0)} 25%{transform:translate(-50%,-50%) rotate(-25deg)} 75%{transform:translate(-50%,-50%) rotate(25deg)} }
        @keyframes ballCaptured { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.3);filter:brightness(2)} 100%{transform:translate(-50%,-50%) scale(.9);filter:brightness(1)} }
        @keyframes ballBreak { 0%{transform:translate(-50%,-50%) scale(1);opacity:1} 30%{transform:translate(-50%,-50%) scale(1.4) rotate(20deg);filter:brightness(2)} 60%{transform:translate(-50%,-50%) scale(.5) rotate(-30deg);opacity:.6} 100%{transform:translate(-50%,-50%) scale(0);opacity:0} }
      `}</style>
    </div></>
  );
}

/* Helpers */
function FireParticles({ phase }: { phase: BossPhase }) {
  const ps = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 5, dur: 5 + Math.random() * 7, size: 2 + Math.random() * 4, op: .2 + Math.random() * .4,
    color: phase === "divine" ? ["#fbbf24","#fef3c7","#fff"][i%3] : phase === "rage" ? ["#ef4444","#dc2626","#f97316"][i%3] : ["#f59e0b","#ef4444","#fbbf24"][i%3],
  })), [phase]);
  return (<div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    {ps.map((p) => <div key={p.id} className="absolute rounded-full" style={{ left:`${p.left}%`, bottom:"-3%", width:p.size, height:p.size, backgroundColor:p.color, boxShadow:`0 0 ${p.size*2}px ${p.color}`, opacity:p.op, animation:`fire-r ${p.dur}s ${p.delay}s infinite linear` }} />)}
    <style>{`@keyframes fire-r { 0%{transform:translateY(0);opacity:0} 10%{opacity:.6} 100%{transform:translateY(-110vh) translateX(${-20+Math.random()*40}px);opacity:0} }`}</style>
  </div>);
}

function RainbowOrbit() {
  return (<div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
    {["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6"].map((c,i) => (
      <div key={i} className="absolute rounded-full" style={{ width:120,height:120,top:"50%",left:"50%",transform:`translate(-50%,-50%) rotate(${i*60}deg) translateX(80px)`,background:`radial-gradient(circle,${c}25,transparent 70%)`,filter:"blur(25px)",animation:`rb-orbit 6s ${i}s linear infinite` }} />
    ))}
    <style>{`@keyframes rb-orbit { 0%{transform:translate(-50%,-50%) rotate(0) translateX(80px) rotate(0)} 100%{transform:translate(-50%,-50%) rotate(360deg) translateX(80px) rotate(-360deg)} }`}</style>
  </div>);
}

function TeamSelect({ team, onSelect, pseudo, musicEnabled, setMusicEnabled }: { team: TeamMember[]; onSelect: (i: number) => void; pseudo: string; musicEnabled: boolean; setMusicEnabled: (v: boolean) => void }) {
  return (<div className="h-dvh w-full p-4 overflow-auto relative" style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 30%,#2d1208,#0a0400)" }}>
    <FireParticles phase="sacred" />
    <div className="max-w-2xl mx-auto relative z-10">
      <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-4 flex justify-between items-start" style={{ boxShadow: "6px 6px 0 #000" }}>
        <div><h1 className="text-lg font-bold text-black mb-1">Boss Final : HO-OH Niv.150</h1><p className="text-xs text-gray-600">Dresseur {pseudo} · 3 Pokéballs · Bonne chance.</p></div>
        <button onClick={() => setMusicEnabled(!musicEnabled)} className="border-2 border-black bg-white px-2 py-1 text-xs font-bold" style={{ boxShadow: "2px 2px 0 #000" }}>{musicEnabled ? "🔊" : "🔇"}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {team.map((m, i) => (
          <button key={i} disabled={m.fainted} onClick={() => !m.fainted && onSelect(i)}
            className="bg-[#f8f0e0] border-4 border-black p-3 text-left disabled:opacity-30 hover:bg-[#ffe080] transition-colors"
            style={{ boxShadow: m.fainted ? "none" : "4px 4px 0 #000" }}>
            <div className="flex items-center justify-center h-16 mb-1">
              {m.data.spriteAnimated ? <img src={m.data.spriteAnimated} alt={m.pokemon.name} style={{ imageRendering: "pixelated", height: "55px" }} /> : m.data.sprite ? <img src={m.data.sprite} alt={m.pokemon.name} style={{ height: "55px" }} /> : null}
            </div>
            <div className="text-[11px] font-bold text-black">{m.pokemon.name.toUpperCase()}</div>
            <div className="text-[9px] text-gray-700">Niv. {m.pokemon.level}</div>
            <div className="text-[9px] text-black font-bold">{m.fainted ? "K.O." : `${m.currentHP}/${m.maxHP}`}</div>
            <div className="flex gap-1 mt-1">{m.data.types.map((t) => <span key={t} className="text-[7px] px-1 py-0.5 text-white font-bold" style={{ background: TYPE_COLORS[t] }}>{t}</span>)}</div>
          </button>
        ))}
      </div>
    </div>
  </div>);
}

function SwitchSelect({ team, onSelect }: { team: TeamMember[]; onSelect: (i: number) => void }) {
  return (<div className="h-dvh w-full p-4 overflow-auto" style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 30%,#2d1208,#0a0400)" }}>
    <div className="max-w-2xl mx-auto">
      <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-4" style={{ boxShadow: "6px 6px 0 #000" }}>
        <h1 className="text-lg font-bold text-black">Pokémon K.O. — Choisis le suivant</h1>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {team.map((m, i) => (
          <button key={i} disabled={m.fainted} onClick={() => !m.fainted && onSelect(i)}
            className="bg-[#f8f0e0] border-4 border-black p-3 text-left disabled:opacity-30 hover:bg-[#ffe080]"
            style={{ boxShadow: m.fainted ? "none" : "4px 4px 0 #000" }}>
            <div className="flex items-center justify-center h-14 mb-1">
              {m.data.spriteAnimated ? <img src={m.data.spriteAnimated} alt="" style={{ imageRendering: "pixelated", height: "50px" }} /> : null}
            </div>
            <div className="text-[11px] font-bold text-black">{m.pokemon.name.toUpperCase()}</div>
            <div className="text-[9px] text-black font-bold">{m.fainted ? "K.O." : `${m.currentHP}/${m.maxHP}`}</div>
          </button>
        ))}
      </div>
    </div>
  </div>);
}

function ResultScreen({ type, pseudo, onClose }: { type: "victory" | "defeat" | "fled"; pseudo: string; onClose: () => void }) {
  const msg = {
    victory: { t: "HO-OH CAPTURÉ !", txt: `Incroyable ${pseudo} ! Le Phénix Arc-en-Ciel t'appartient !`, c: "#fbbf24", e: "🌈" },
    defeat: { t: "DÉFAITE…", txt: "Les flammes sacrées de Ho-Oh sont trop puissantes…", c: "#e03030", e: "💀" },
    fled: { t: "HO-OH S'ENVOLE", txt: "Tu as terrassé Ho-Oh mais il s'est envolé…", c: "#94a3b8", e: "🕊️" },
  }[type];
  useEffect(() => { const t = setTimeout(onClose, 8000); return () => clearTimeout(t); }, [onClose]);
  return (<div className="h-dvh w-full flex items-center justify-center p-6 relative overflow-hidden" style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 40%,#2d1208,#0a0400)" }}>
    {type === "victory" && <><FireParticles phase="divine" /><RainbowOrbit /></>}
    <motion.div initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="bg-[#f8f0e0] border-4 border-black p-8 max-w-md text-center relative z-10"
      style={{ boxShadow: type === "victory" ? "8px 8px 0 #000, 0 0 40px rgba(251,191,36,.3)" : "8px 8px 0 #000" }}>
      <motion.div className="text-5xl mb-4" animate={type === "victory" ? { rotate: [0,10,-10,0], scale: [1,1.2,1] } : {}} transition={{ duration: 2, repeat: Infinity }}>{msg.e}</motion.div>
      <h1 className="text-2xl font-bold mb-4" style={{ color: msg.c }}>{msg.t}</h1>
      <p className="text-sm text-black mb-6">{msg.txt}</p>
      {type === "victory" && <div className="flex justify-center gap-0.5 mb-4">{["#ef4444","#f97316","#fbbf24","#22c55e","#3b82f6","#8b5cf6","#ec4899"].map((c,i) => <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .3+i*.08 }} className="w-4 h-1 rounded-full" style={{ background: c }} />)}</div>}
      <button onClick={onClose} className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-gray-800">FERMER</button>
    </motion.div>
  </div>);
}
