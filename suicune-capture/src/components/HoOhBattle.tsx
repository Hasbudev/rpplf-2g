"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchPokemonData, type PokemonData } from "../lib/pokeApi";
import {
  getEffectiveness, pickMovesForPokemon,
  TYPE_COLORS, HOOH_TYPES, getHoOhMoves, PHASE_NAMES, PHASE_COLORS,
  ITEMS, EV_SPREADS,
  type Move, type PokemonType, type StatusState, type BossPhase, type Item, type EVSpread,
} from "../lib/battleSystem";
import { TeamBuilder, type TeamMemberConfig } from "./TeamBuilder";
import { updateLiveBattle } from "../hooks/useEvent";
import { HoOhIntroScene, HoOhRageScene, HoOhDivineScene, HoOhVictoryScene } from "./DialogueScene";
import type { Player, PlayerPokemon } from "../lib/playerRoster";

/* ═══════════════════════════════════════════════
   ⚔️  BALANCED COMBAT ENGINE
   
   Damage model: % of target's maxHP
   This makes fights last the same number of turns
   regardless of move type or pokémon used.
   Type effectiveness still matters but can't one-shot.

   Player → Ho-Oh:
     Base: 6–12% of Ho-Oh maxHP depending on move power
     STAB:        ×1.25
     Super eff:   ×1.50  (capped — no 4× mechanic)
     Not eff:     ×0.55
     Immune:       0
     Crit (6%):   ×1.50
     EV atkMult applied on top

   Ho-Oh → Player:
     Phase 1: 14–20% of player maxHP
     Phase 2: 20–28%
     Phase 3: 28–38%
     Super eff:   ×1.35
     Not eff:     ×0.60
     EV defMult + item applied on top
   
   Each phase has its own HP pool.
   Ho-Oh resurrects at 100% HP on phase transitions.
   Ho-Oh heals (Aurore) at ≤50% HP, 80% chance, heals 40% maxHP.
   ═══════════════════════════════════════════════ */

// ── Phase configuration ──────────────────────────────────────────────
const PHASE_CONFIG = {
  sacred: {
    hp: 420, label: "PHASE I · Flamme Sacrée",
    // Damage Ho-Oh deals as % of player maxHP
    dmgMin: 0.14, dmgMax: 0.20,
    // Crit chance for this phase
    critChance: 0.05,
  },
  rage: {
    hp: 560, label: "PHASE II · Colère Ardente",
    dmgMin: 0.20, dmgMax: 0.28,
    critChance: 0.08,
  },
  divine: {
    hp: 720, label: "PHASE III · Jugement Divin",
    dmgMin: 0.28, dmgMax: 0.38,
    critChance: 0.12,
  },
} as const;

// % of Ho-Oh maxHP dealt per move power tier
function playerDamagePct(power: number): number {
  if (power === 0)    return 0;
  if (power <= 55)    return 0.055;
  if (power <= 80)    return 0.080;
  if (power <= 100)   return 0.105;
  return                     0.130;
}

// Cap effectiveness to prevent one-shots (max 1.6×, min 0.5×)
function cappedEff(raw: number): number {
  if (raw === 0) return 0;
  return Math.max(0.5, Math.min(1.6, raw));
}

const AURORE_THRESHOLD = 0.50; // heal when HP < 50%
const AURORE_CHANCE    = 0.80;
const AURORE_HEAL_PCT  = 0.40;
const MAX_POKEBALLS    = 3;
const CAPTURE_REQS     = { // % thresholds for capture rates
  red:    0.15, // <15% HP → 8% capture
  yellow: 0.30, // <30% HP → 3%
  green:  1.00, //         → 0.5%
};

// ── Types ────────────────────────────────────────────────────────────
type Phase = "loading" | "builder" | "team_select" | "hooh_intro" | "battle" | "switch" | "rage_scene" | "divine_scene" | "victory_scene" | "victory" | "defeat" | "fled";

interface TeamMember {
  pokemon: PlayerPokemon;
  data: PokemonData;
  currentHP: number;
  maxHP: number;
  fainted: boolean;
  moves: Move[];
  status: StatusState;
  item: Item;
  evSpread: EVSpread;
  itemUsed: boolean;   // for one-use items
}

interface BossState {
  hp: number;
  maxHP: number;
  phase: BossPhase;
  auroreLeft: number;
  status: StatusState;
  pokeballsLeft: number;
  log: string[];
  busy: boolean;
}

function getNextPhase(p: BossPhase): BossPhase | null {
  if (p === "sacred") return "rage";
  if (p === "rage")   return "divine";
  return null;
}

function captureRate(hpPct: number): number {
  if (hpPct < CAPTURE_REQS.red)    return 0.08;
  if (hpPct < CAPTURE_REQS.yellow) return 0.03;
  return 0.005;
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export function HoOhBattle({
  pseudo, player, onComplete,
}: {
  pseudo: string;
  player: Player;
  onComplete: (won: boolean) => void;
}) {
  const [phase, setPhase]     = useState<Phase>("loading");
  const [team, setTeam]       = useState<TeamMember[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const teamRef = useRef<TeamMember[]>([]);
  useEffect(() => { teamRef.current = team; }, [team]);

  const [boss, setBoss] = useState<BossState>({
    hp: PHASE_CONFIG.sacred.hp, maxHP: PHASE_CONFIG.sacred.hp,
    phase: "sacred", auroreLeft: 2, status: { status: null },
    pokeballsLeft: MAX_POKEBALLS, log: [], busy: false,
  });
  const bossRef = useRef<BossState>(boss);
  useEffect(() => { bossRef.current = boss; }, [boss]);

  const [menuMode,    setMenuMode]    = useState<"main" | "moves">("main");
  const [transition,  setTransition]  = useState<BossPhase | null>(null);
  const [ballAnim,    setBallAnim]    = useState<"idle"|"throwing"|"shaking"|"success"|"fail">("idle");

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // ── Load team ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const td: TeamMember[] = [];
      for (const p of player.team) {
        const data = await fetchPokemonData(p.name);
        if (data) {
          const p100     = { ...p, level: 100 };
          // HP formula: (2 * base * 100) / 100 + 100 + 10
          const maxHP    = Math.floor((2 * data.baseHP * 100) / 100 + 110);
          td.push({
            pokemon: p100, data,
            currentHP: maxHP, maxHP,
            fainted: false,
            moves: pickMovesForPokemon(data.types),
            status: { status: null },
            item: ITEMS[0], evSpread: EV_SPREADS[0], itemUsed: false,
          });
        }
      }
      setTeam(td);
      setPhase("builder");
    })();
  }, [player]);

  // ── TeamBuilder confirm ───────────────────────────────────────────
  const handleBuilderConfirm = useCallback((configs: TeamMemberConfig[]) => {
    setTeam(prev => prev.map((m, i) => {
      const cfg = configs[i];
      if (!cfg) return m;
      const newMaxHP = Math.floor(m.maxHP * cfg.evSpread.hpMult);
      return { ...m, moves: cfg.moves, item: cfg.item, evSpread: cfg.evSpread, maxHP: newMaxHP, currentHP: newMaxHP, itemUsed: false };
    }));
    setPhase("team_select");
  }, []);

  // ── Start battle ─────────────────────────────────────────────────
  const startBattle = useCallback((idx: number) => {
    setActiveIdx(idx);
    setPhase("hooh_intro");
  }, []);

  const actuallyStartBattle = useCallback((idx: number) => {
    setActiveIdx(idx);
    const cfg = PHASE_CONFIG.sacred;
    setBoss({
      hp: cfg.hp, maxHP: cfg.hp, phase: "sacred", auroreLeft: 2,
      status: { status: null }, pokeballsLeft: MAX_POKEBALLS,
      log: ["Le ciel s'embrase d'un arc-en-ciel sacré…", "HO-OH apparaît dans un torrent de flammes sacrées !"],
      busy: false,
    });
    setPhase("battle");
    setMenuMode("main");
  }, []);

  // ── Switch ───────────────────────────────────────────────────────
  const switchPoke = useCallback((idx: number) => {
    const name = teamRef.current[idx]?.pokemon.name.toUpperCase() ?? "";
    setActiveIdx(idx);
    setBoss(b => ({ ...b, log: [`Allez, ${name} !`, "Que voulez-vous faire ?"], busy: false }));
    setPhase("battle");
    setMenuMode("main");
  }, []);

  /* ──────────────────────────────────────────────────────────────────
     BOSS TURN — ho-oh attacks player
  ────────────────────────────────────────────────────────────────── */
  const bossTurn = useCallback(async (active: TeamMember, b: BossState): Promise<boolean> => {
    // Paralysis skip
    if (b.status.status === "paralysis" && Math.random() < 0.25) {
      setBoss(prev => ({ ...prev, log: ["HO-OH est paralysé et ne peut pas attaquer !"] }));
      await sleep(1300);
      return false;
    }

    // Pick move
    const moves = getHoOhMoves(b.phase);
    const cfg   = PHASE_CONFIG[b.phase];

    // Try Aurore heal first
    if (b.hp / b.maxHP < AURORE_THRESHOLD && b.auroreLeft > 0 && Math.random() < AURORE_CHANCE) {
      const heal    = Math.floor(b.maxHP * AURORE_HEAL_PCT);
      const newHP   = Math.min(b.maxHP, b.hp + heal);
      setBoss(prev => ({
        ...prev, hp: newHP, auroreLeft: prev.auroreLeft - 1,
        log: ["HO-OH utilise AURORE !", `HO-OH récupère ${heal} PV ! (${newHP}/${b.maxHP})`],
      }));
      await sleep(1600);
      return false;
    }

    // Attacking move — % based
    const atk = moves.filter(m => m.power > 0);
    if (!atk.length) return false;
    const move = atk[Math.floor(Math.random() * atk.length)];

    const eff  = getEffectiveness(move.type, active.data.types);
    if (eff === 0) {
      setBoss(prev => ({ ...prev, log: [`HO-OH utilise ${move.name} !`, `Ça n'affecte pas ${active.pokemon.name.toUpperCase()} !`] }));
      await sleep(1400);
      return false;
    }

    const effMult  = eff > 1 ? 1.35 : eff < 1 ? 0.60 : 1.0;
    const isCrit   = Math.random() < cfg.critChance;
    const randMult = 0.85 + Math.random() * 0.15;
    const basePct  = cfg.dmgMin + Math.random() * (cfg.dmgMax - cfg.dmgMin);
    const stab     = (HOOH_TYPES as string[]).includes(move.type) ? 1.2 : 1.0;

    let dmg = Math.floor(
      active.maxHP * basePct * effMult * stab * randMult * (isCrit ? 1.5 : 1) * active.evSpread.defMult
    );
    if (active.item.effect === "assaultvest") dmg = Math.floor(dmg * 0.75);

    const effMsg = eff > 1 ? " C'est super efficace !" : eff < 1 ? " Pas très efficace…" : "";
    const critMsg = isCrit ? " Coup critique !" : "";
    setBoss(prev => ({ ...prev, log: [`HO-OH utilise ${move.name} !`] }));
    await sleep(900);
    setBoss(prev => ({ ...prev, log: [...prev.log, `${dmg} dégâts !${effMsg}${critMsg}`] }));

    const newHP = Math.max(0, active.currentHP - dmg);
    setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
    await sleep(1000);

    // Focussash
    if (active.item.effect === "focussash" && !active.itemUsed && active.currentHP === active.maxHP && newHP <= 0) {
      setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: 1, fainted: false, itemUsed: true } : m));
      setBoss(prev => ({ ...prev, log: [...prev.log, `Filet Faîte ! ${active.pokemon.name.toUpperCase()} survit à 1 PV !`] }));
      await sleep(1200);
      return false;
    }

    // Status effect
    if (move.effect && move.effectChance && Math.random() < move.effectChance && active.status.status === null) {
      if (!(move.effect === "burn" && active.data.types.includes("Feu"))) {
        setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, status: { status: move.effect! } } : m));
        const statusLabel = move.effect === "burn" ? "brûlé" : move.effect === "paralysis" ? "paralysé" : move.effect;
        setBoss(prev => ({ ...prev, log: [...prev.log, `${active.pokemon.name.toUpperCase()} est ${statusLabel} !`] }));
        await sleep(1100);
      }
    }

    // Rockyhelmet recoil
    if (active.item.effect === "rockyhelmet" && dmg > 0) {
      const recoil = Math.floor(b.maxHP * 0.06);
      const bNewHP = Math.max(0, bossRef.current.hp - recoil);
      setBoss(prev => ({ ...prev, hp: bNewHP, log: [...prev.log, `Casque Gonflant ! HO-OH perd ${recoil} PV !`] }));
      await sleep(800);
    }

    if (newHP <= 0) {
      setBoss(prev => ({ ...prev, log: [...prev.log, `${active.pokemon.name.toUpperCase()} est K.O. !`] }));
      await sleep(1500);
      const alive = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted);
      if (alive.length === 0) {
        updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "defeat", battlePhase: "hooh", lastAction: "Équipe KO" });
        setPhase("defeat"); return true;
      }
      setBoss(prev => ({ ...prev, busy: false }));
      setPhase("switch"); return true;
    }
    return false;
  }, [activeIdx, pseudo]);

  /* ──────────────────────────────────────────────────────────────────
     PLAYER ATTACKS
  ────────────────────────────────────────────────────────────────── */
  const playerAttack = useCallback(async (moveIdx: number) => {
    const active = teamRef.current[activeIdx];
    const b      = bossRef.current;
    if (!active || b.busy) return;

    setBoss(prev => ({ ...prev, busy: true }));
    setMenuMode("main");

    // Status checks
    if (active.status.status === "paralysis" && Math.random() < 0.25) {
      setBoss(prev => ({ ...prev, log: [`${active.pokemon.name.toUpperCase()} est paralysé !`], busy: false }));
      await sleep(1200);
      setBoss(prev => ({ ...prev, log: [...prev.log, "Que voulez-vous faire ?"] }));
      return;
    }
    if (active.status.status === "sleep") {
      setBoss(prev => ({ ...prev, log: [`${active.pokemon.name.toUpperCase()} est endormi !`], busy: false }));
      await sleep(1200);
      setBoss(prev => ({ ...prev, log: [...prev.log, "Que voulez-vous faire ?"] }));
      return;
    }

    const move = active.moves[moveIdx];
    if (!move) return;

    setBoss(prev => ({ ...prev, log: [`${active.pokemon.name.toUpperCase()} utilise ${move.name} !`] }));
    await sleep(900);

    if (move.power === 0) {
      // Status move — apply effect to boss
      setBoss(prev => ({
        ...prev, status: { status: move.effect ?? null },
        log: [...prev.log, `HO-OH est affecté par ${move.name} !`], busy: false,
      }));
      await sleep(1100);
      setBoss(prev => ({ ...prev, log: [...prev.log, "Que voulez-vous faire ?"], busy: false }));
      return;
    }

    const rawEff  = getEffectiveness(move.type, HOOH_TYPES as PokemonType[]);
    if (rawEff === 0) {
      setBoss(prev => ({ ...prev, log: [...prev.log, "Ça n'affecte pas HO-OH !"], busy: false }));
      await sleep(1200);
      setBoss(prev => ({ ...prev, log: [...prev.log, "Que voulez-vous faire ?"] }));
      return;
    }

    const effMult   = cappedEff(rawEff);
    const stab      = active.data.types.includes(move.type) ? 1.25 : 1.0;
    const isCrit    = Math.random() < 0.06;
    const randMult  = 0.85 + Math.random() * 0.15;
    const basePct   = playerDamagePct(move.power);
    
    let dmg = Math.floor(
      b.maxHP * basePct * effMult * stab * randMult * (isCrit ? 1.5 : 1) * active.evSpread.atkMult
    );
    // Items
    if (active.item.effect === "lifeorb")      dmg = Math.floor(dmg * 1.30);
    if (active.item.effect === "choiceband")   dmg = Math.floor(dmg * 1.50);
    if (active.item.effect === "choicespecs")  dmg = Math.floor(dmg * 1.50);

    const effMsg  = rawEff > 1 ? " C'est super efficace !" : rawEff < 1 ? " Pas très efficace…" : "";
    const critMsg = isCrit ? " Coup critique !" : "";
    setBoss(prev => ({ ...prev, log: [...prev.log, `${dmg} dégâts !${effMsg}${critMsg}`] }));

    const newBossHP   = Math.max(0, b.hp - dmg);
    const newBossPhase = newBossHP / b.maxHP < 0.33 ? (b.phase === "sacred" ? "rage" : b.phase === "rage" ? "divine" : b.phase) : b.phase;
    setBoss(prev => ({ ...prev, hp: newBossHP }));
    await sleep(1000);

    // Life Orb recoil
    if (active.item.effect === "lifeorb" && dmg > 0) {
      const recoil = Math.floor(active.maxHP * 0.10);
      const newHP  = Math.max(1, active.currentHP - recoil);
      setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP } : m));
      setBoss(prev => ({ ...prev, log: [...prev.log, `Orbe Vie ! -${recoil} PV`] }));
      await sleep(700);
    }

    // Shell Bell heal
    if (active.item.effect === "shellbell" && dmg > 0) {
      const heal  = Math.floor(dmg / 8);
      const newHP = Math.min(active.maxHP, active.currentHP + heal);
      setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP } : m));
      if (heal > 0) setBoss(prev => ({ ...prev, log: [...prev.log, `Coque Cloche ! +${heal} PV`] }));
      await sleep(700);
    }

    // Boss death → phase transition or victory
    if (newBossHP <= 0) {
      const next = getNextPhase(b.phase);
      if (next) {
        setBoss(prev => ({ ...prev, hp: 0, log: [...prev.log, "HO-OH s'effondre… mais ce n'est pas fini !"], busy: true }));
        await sleep(2000);
        setTransition(next);
        await sleep(4500);
        setTransition(null);
        const cfg = PHASE_CONFIG[next];
        setBoss({
          hp: cfg.hp, maxHP: cfg.hp, phase: next, auroreLeft: 2,
          status: { status: null }, pokeballsLeft: b.pokeballsLeft,
          log: ["HO-OH ressuscite…", "Prépare-toi !"],
          busy: false,
        });
        // Show dialogue scene for phase transition
        if (next === "rage")   { setPhase("rage_scene");   return; }
        if (next === "divine") { setPhase("divine_scene"); return; }
        updateLiveBattle({ pseudo, pokemon: "ho-oh", battlePhase: "hooh", bossPhase: next, status: "in_battle", lastAction: `Phase → ${next}` });
        return;
      }
      // Final death → victory
      setBoss(prev => ({ ...prev, busy: false }));
      updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "fled", battlePhase: "hooh", lastAction: "Ho-Oh vaincu !" });
      await sleep(2000);
      setPhase("fled");
      return;
    }

    // Boss end-of-turn status (burn/poison)
    const cur = bossRef.current;
    if (cur.status.status === "burn" || cur.status.status === "poison") {
      const dot = Math.floor(cur.maxHP * 0.08);
      const bHP = Math.max(0, cur.hp - dot);
      setBoss(prev => ({ ...prev, hp: bHP, log: [...prev.log, cur.status.status === "burn" ? `Brûlure ! HO-OH perd ${dot} PV !` : `Poison ! HO-OH perd ${dot} PV !`] }));
      await sleep(900);
      if (bHP <= 0) {
        const next = getNextPhase(cur.phase);
        if (next) {
          setTransition(next);
          await sleep(4500);
          setTransition(null);
          const cfg = PHASE_CONFIG[next];
          setBoss({ hp: cfg.hp, maxHP: cfg.hp, phase: next, auroreLeft: 2, status: { status: null }, pokeballsLeft: cur.pokeballsLeft, log: ["HO-OH ressuscite…", "Que voulez-vous faire ?"], busy: false });
          return;
        }
        setPhase("fled"); return;
      }
    }

    // Player end-of-turn status
    const activeCur = teamRef.current[activeIdx];
    if (activeCur && !activeCur.fainted) {
      if (activeCur.status.status === "burn") {
        const dot   = Math.floor(activeCur.maxHP * 0.0625);
        const newHP = Math.max(0, activeCur.currentHP - dot);
        setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
        setBoss(prev => ({ ...prev, log: [...prev.log, `Brûlure ! ${activeCur.pokemon.name.toUpperCase()} perd ${dot} PV !`] }));
        await sleep(900);
        if (newHP <= 0) {
          const alive = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted);
          if (alive.length === 0) { setPhase("defeat"); return; }
          setBoss(prev => ({ ...prev, busy: false }));
          setPhase("switch"); return;
        }
      }
      // Leftovers heal
      if (activeCur.item.effect === "leftovers") {
        const heal  = Math.floor(activeCur.maxHP / 16);
        const newHP = Math.min(activeCur.maxHP, activeCur.currentHP + heal);
        if (newHP > activeCur.currentHP) {
          setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP } : m));
          setBoss(prev => ({ ...prev, log: [...prev.log, `Restes ! +${heal} PV`] }));
          await sleep(700);
        }
      }
      // Sitrus Berry trigger
      const activeAfterDot = teamRef.current[activeIdx];
      if (activeAfterDot && activeAfterDot.item.effect === "sitrusberry" && !activeAfterDot.itemUsed && activeAfterDot.currentHP / activeAfterDot.maxHP < 0.5) {
        const heal  = Math.floor(activeAfterDot.maxHP * 0.25);
        const newHP = Math.min(activeAfterDot.maxHP, activeAfterDot.currentHP + heal);
        setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP, itemUsed: true } : m));
        setBoss(prev => ({ ...prev, log: [...prev.log, `Baie Sitrus ! +${heal} PV`] }));
        await sleep(900);
      }
      // Lum Berry trigger
      if (activeAfterDot && activeAfterDot.item.effect === "lumberry" && !activeAfterDot.itemUsed && activeAfterDot.status.status !== null) {
        setTeam(prev => prev.map((m, i) => i === activeIdx ? { ...m, status: { status: null }, itemUsed: true } : m));
        setBoss(prev => ({ ...prev, log: [...prev.log, "Baie Lum ! Statut soigné !"] }));
        await sleep(900);
      }
    }

    // Boss turn
    const latestActive = teamRef.current[activeIdx];
    if (!latestActive || latestActive.fainted) return;
    const ko = await bossTurn(latestActive, bossRef.current);
    if (!ko) {
      setBoss(prev => ({ ...prev, busy: false, log: [...prev.log, "Que voulez-vous faire ?"] }));
    }
  }, [activeIdx, bossTurn, pseudo]);

  /* ──────────────────────────────────────────────────────────────────
     THROW POKEBALL
  ────────────────────────────────────────────────────────────────── */
  const throwBall = useCallback(async () => {
    const b = bossRef.current;
    const active = teamRef.current[activeIdx];
    if (!active || b.busy || b.pokeballsLeft <= 0) return;

    setBoss(prev => ({ ...prev, busy: true, pokeballsLeft: prev.pokeballsLeft - 1, log: ["Vous lancez une Pokéball !"] }));
    setBallAnim("throwing"); await sleep(900);
    setBallAnim("shaking");
    setBoss(prev => ({ ...prev, log: [...prev.log, "La Pokéball tremble…"] }));
    await sleep(2400);

    const rate = captureRate(b.hp / b.maxHP);
    if (Math.random() < rate) {
      setBallAnim("success");
      setBoss(prev => ({ ...prev, log: [...prev.log, "HO-OH A ÉTÉ CAPTURÉ !!!"] }));
      updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "victory", battlePhase: "hooh", lastAction: "HO-OH CAPTURÉ !" });
      await sleep(2500);
      setPhase("victory_scene"); return;
    }

    setBallAnim("fail");
    setBoss(prev => ({ ...prev, log: [...prev.log, "HO-OH brise la Pokéball !"] }));
    await sleep(1500); setBallAnim("idle");

    if (b.pokeballsLeft - 1 <= 0) {
      await sleep(1500);
      setBoss(prev => ({ ...prev, busy: false }));
      setPhase("defeat"); return;
    }

    const ko = await bossTurn(active, bossRef.current);
    if (!ko) setBoss(prev => ({ ...prev, busy: false, log: [...prev.log, "Que voulez-vous faire ?"] }));
  }, [activeIdx, bossTurn, pseudo]);

  /* ──────────────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────────────── */
  if (phase === "hooh_intro") return (
    <HoOhIntroScene pseudo={pseudo} onComplete={() => {
      setBoss(b => ({ ...b, log: ["Le ciel s'embrase d'un arc-en-ciel sacré…", "HO-OH apparaît dans un torrent de flammes sacrées !"] }));
      setPhase("battle");
      setMenuMode("main");
    }} />
  );
  if (phase === "rage_scene") return (
    <HoOhRageScene onComplete={() => setPhase("battle")} />
  );
  if (phase === "divine_scene") return (
    <HoOhDivineScene onComplete={() => setPhase("battle")} />
  );
  if (phase === "loading") return (
    <div className="h-dvh w-full flex items-center justify-center"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #2d1208, #0a0400)", fontFamily: "'Courier New', monospace" }}>
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-amber-300/50 text-sm">Chargement de l'équipe…</p>
      </div>
    </div>
  );
  if (phase === "builder") return (
    <TeamBuilder
      team={team.map(m => ({ pokemon: m.pokemon, data: m.data, maxHP: m.maxHP }))}
      title="Boss Final — HO-OH"
      subtitle="3 phases · configure tes sets"
      onConfirm={handleBuilderConfirm}
    />
  );

  if (phase === "team_select") return (
    <TeamSelect team={team} onSelect={startBattle} pseudo={pseudo} />
  );

  if (phase === "switch") return (
    <SwitchSelect team={team} onSelect={switchPoke} />
  );

  if (phase === "victory_scene") return <HoOhVictoryScene pseudo={pseudo} onComplete={() => onComplete(true)} />;
  if (phase === "victory") return <ResultScreen type="victory" pseudo={pseudo} onClose={() => setPhase("victory_scene")} />;
  if (phase === "defeat")  return <ResultScreen type="defeat"  pseudo={pseudo} onClose={() => onComplete(false)} />;
  if (phase === "fled")    return <ResultScreen type="fled"    pseudo={pseudo} onClose={() => setPhase("victory_scene")} />;

  const active = team[activeIdx];
  if (!active) return null;

  const bp        = boss.phase;
  const pc        = PHASE_COLORS[bp];
  const hpPct     = boss.hp / boss.maxHP;
  const pHpPct    = active.currentHP / active.maxHP;
  const hpColor   = (p: number) => p > 0.5 ? "#22c55e" : p > 0.2 ? "#f59e0b" : "#ef4444";
  const cap       = (captureRate(hpPct) * 100).toFixed(1);
  const hidden    = ballAnim === "throwing" || ballAnim === "shaking" || ballAnim === "success";

  const BOSS_SPRITE = bp === "rage"
    ? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/250.gif"
    : "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/250.gif";

  const spriteWidth = bp === "divine" ? "min(260px,50vw)" : bp === "rage" ? "min(210px,42vw)" : "min(170px,36vw)";

  const bossFilter = bp === "divine"
    ? "drop-shadow(0 0 35px rgba(255,210,0,0.9)) brightness(1.5) saturate(2.2) hue-rotate(5deg)"
    : bp === "rage"
    ? "drop-shadow(0 0 25px rgba(220,30,30,0.85)) hue-rotate(340deg) saturate(2.0) brightness(1.1)"
    : `drop-shadow(0 0 20px ${pc.glow}) brightness(1.05)`;

  const arenaBg = bp === "divine"
    ? "linear-gradient(180deg,#1a1000 0%,#0f0800 60%,#000 100%)"
    : bp === "rage"
    ? "linear-gradient(180deg,#2a0000 0%,#1a0000 60%,#0a0000 100%)"
    : "linear-gradient(180deg,#2d1208 0%,#1a0800 60%,#0a0400 100%)";

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden" style={{ fontFamily: "'Courier New', monospace" }}>

      {/* Phase transition overlay */}
      <AnimatePresence>
        {transition && <PhaseTransitionOverlay phase={transition} />}
      </AnimatePresence>

      {/* Arena */}
      <div className="relative flex-1 overflow-hidden" style={{ background: arenaBg, minHeight: "55%" }}>
        <Particles phase={bp} />
        {bp === "divine" && <DivineRings />}
        {bp === "rage"   && <RageEdge />}

        {/* Ho-Oh HP bar */}
        <div className="absolute top-2 left-2 z-20 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 max-w-[58%]"
          style={{ boxShadow: bp !== "sacred" ? `4px 4px 0 #000, 0 0 16px ${pc.glow}` : "4px 4px 0 #000" }}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-[12px] font-black text-black">HO-OH</span>
            <span className="text-[8px] font-black px-1.5 py-0.5"
              style={{ background: pc.primary, color: "#000" }}>
              {PHASE_CONFIG[bp].label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[8px] font-bold text-black w-4">PV</span>
            <div className="flex-1 h-2.5 bg-gray-800 border border-black" style={{ padding: "1px" }}>
              <div style={{
                width: `${hpPct * 100}%`, height: "100%",
                background: hpColor(hpPct), transition: "width .5s, background .5s",
              }} />
            </div>
            <span className="text-[9px] font-bold" style={{ color: hpColor(hpPct) }}>
              {boss.hp}/{boss.maxHP}
            </span>
          </div>
          <div className="flex gap-2 text-[8px] text-gray-600">
            <span>Capture: <strong style={{ color: hpColor(hpPct) }}>{cap}%</strong></span>
            <span>Soins: {boss.auroreLeft}</span>
            {boss.status.status && <span style={{ color: "#f59e0b" }}>⚡ {boss.status.status}</span>}
          </div>
        </div>

        {/* Pokéballs + phase indicator */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: MAX_POKEBALLS }).map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full border-2 border-black"
                style={{
                  background: i < boss.pokeballsLeft ? "linear-gradient(180deg,#ef4444 50%,#fff 50%)" : "#555",
                  opacity: i < boss.pokeballsLeft ? 1 : 0.3,
                }} />
            ))}
          </div>
        </div>

        {/* Ho-Oh sprite */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          animate={hidden ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}>
          {/* Aura */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
            style={{
              width: bp === "divine" ? "380px" : "260px",
              height: bp === "divine" ? "380px" : "260px",
              background: `radial-gradient(circle, ${pc.glow}, transparent 65%)`,
              filter: "blur(30px)",
              animation: "auraPulse 2.5s ease-in-out infinite",
            }} />
          <img key={bp} src={BOSS_SPRITE} alt="Ho-Oh"
            style={{
              imageRendering: "pixelated", width: spriteWidth,
              filter: bossFilter, position: "relative",
              animation: "hoohFloat 3s ease-in-out infinite",
              transition: "width 1.5s ease, filter 1.5s ease",
            }}
            onError={e => { e.currentTarget.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/250.png"; }}
          />
        </motion.div>

        {/* Pokeball anim */}
        {ballAnim !== "idle" && (
          <div className="absolute z-30 pointer-events-none"
            style={{ top: "50%", left: "50%", width: "48px", height: "48px", transform: "translate(-50%,-50%)",
              animation: ballAnim === "throwing" ? "ballThrow .9s forwards" : ballAnim === "shaking" ? "ballShake .6s infinite" : ballAnim === "success" ? "ballCaptured 1.2s forwards" : "ballBreak 1.2s forwards" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,.5))" }}>
              <circle cx="24" cy="24" r="22" fill="#fff" stroke="#000" strokeWidth="3"/>
              <path d="M2 24A22 22 0 0146 24L2 24Z" fill="#ef4444" stroke="#000" strokeWidth="3"/>
              <line x1="2" y1="24" x2="46" y2="24" stroke="#000" strokeWidth="3"/>
              <circle cx="24" cy="24" r="6" fill="#fff" stroke="#000" strokeWidth="3"/>
              <circle cx="24" cy="24" r="2.5" fill="#ccc"/>
            </svg>
          </div>
        )}

        {/* Player sprite */}
        <motion.div className="absolute z-10" style={{ bottom: "10%", left: "7%" }}
          animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          {active.data.spriteAnimated
            ? <img src={active.data.spriteAnimated} alt={active.pokemon.name}
                style={{ imageRendering: "pixelated", width: "min(120px,24vw)", transform: "scaleX(-1)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.5))" }} />
            : active.data.sprite
            ? <img src={active.data.sprite} alt={active.pokemon.name}
                style={{ width: "min(100px,20vw)", transform: "scaleX(-1)" }} />
            : null}
        </motion.div>

        {/* Player HP */}
        <div className="absolute bottom-2 right-2 z-20 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 max-w-[50%]"
          style={{ boxShadow: "4px 4px 0 #000" }}>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[12px] font-black text-black">{active.pokemon.name.toUpperCase()}</span>
            <span className="text-[9px] text-gray-500">Niv.100</span>
            {active.status.status && (
              <span className="text-[7px] font-black px-1 py-0.5 text-white"
                style={{ background: active.status.status === "burn" ? "#ef4444" : active.status.status === "paralysis" ? "#f59e0b" : "#a855f7" }}>
                {active.status.status.substring(0, 3).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[8px] font-bold text-black w-4">PV</span>
            <div className="flex-1 h-2.5 bg-gray-800 border border-black" style={{ padding: "1px", minWidth: "80px" }}>
              <div style={{ width: `${pHpPct * 100}%`, height: "100%", background: hpColor(pHpPct), transition: "width .5s" }} />
            </div>
          </div>
          <span className="text-[9px] font-bold text-black">{active.currentHP}/{active.maxHP}</span>
          {active.item.effect !== "none" && (
            <div className="text-[7px] text-gray-500 mt-0.5">{active.item.emoji} {active.item.name}</div>
          )}
        </div>
      </div>

      {/* Command panel */}
      <div style={{
        background: bp === "divine" ? "linear-gradient(180deg,#fef3c7,#fffbeb)" : bp === "rage" ? "linear-gradient(180deg,#fff0f0,#fff5f5)" : "#f8f0e0",
        borderTop: `4px solid ${bp === "divine" ? "#f59e0b" : bp === "rage" ? "#dc2626" : "#000"}`,
        minHeight: "200px", padding: "8px 10px 10px",
      }}>
        {/* Log */}
        <div className="bg-white border-[3px] border-black p-2.5 mb-2 relative" style={{ boxShadow: "4px 4px 0 #000", minHeight: "52px" }}>
          <div className="absolute top-1 left-1 right-1 bottom-1 border border-gray-200 pointer-events-none" />
          {boss.log.slice(-2).map((l, i) => (
            <p key={i} className="text-[13px] text-black font-bold leading-snug">{l}</p>
          ))}
        </div>

        {/* Buttons */}
        {menuMode === "main" ? (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={boss.busy} onClick={() => setMenuMode("moves")}
              className="border-[3px] border-black p-3 text-sm font-black disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ boxShadow: "4px 4px 0 #000", background: TYPE_COLORS[active.data.types[0] || "Normal"], color: "#000" }}>
              ⚔️ ATTAQUE
            </button>
            <button disabled={boss.busy || boss.pokeballsLeft <= 0} onClick={throwBall}
              className="border-[3px] border-black p-3 text-sm font-black disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ boxShadow: "4px 4px 0 #000", background: boss.pokeballsLeft > 0 ? "#ef4444" : "#9ca3af", color: "#fff" }}>
              🔴 BALL ({boss.pokeballsLeft})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {active.moves.map((m, i) => {
              const rawE = getEffectiveness(m.type, HOOH_TYPES as PokemonType[]);
              const effLabel = rawE === 0 ? "❌" : rawE > 1 ? "⬆️" : rawE < 1 ? "⬇️" : "";
              return (
                <button key={i} disabled={boss.busy} onClick={() => playerAttack(i)}
                  className="border-[3px] border-black p-2 text-left disabled:opacity-40 active:translate-x-[1px] active:translate-y-[1px]"
                  style={{ boxShadow: "3px 3px 0 #000", background: TYPE_COLORS[m.type], color: "#000" }}>
                  <div className="text-[11px] font-black flex justify-between">
                    <span>{m.name.toUpperCase()}</span>
                    <span>{effLabel}</span>
                  </div>
                  <div className="text-[9px] opacity-70">{m.power > 0 ? `Pui: ${m.power}` : "STATUT"} · {m.type}</div>
                </button>
              );
            })}
            <button onClick={() => setMenuMode("main")}
              className="col-span-2 text-[10px] text-black font-bold underline text-center mt-0.5">
              ← Retour
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes hoohFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes auraPulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.7} 50%{transform:translate(-50%,-50%) scale(1.2);opacity:1} }
        @keyframes ballThrow { 0%{top:90%;left:15%;transform:translate(-50%,-50%) scale(.6)} 100%{top:50%;left:50%;transform:translate(-50%,-50%) rotate(720deg) scale(1)} }
        @keyframes ballShake { 0%,100%{transform:translate(-50%,-50%) rotate(0)} 25%{transform:translate(-50%,-50%) rotate(-25deg)} 75%{transform:translate(-50%,-50%) rotate(25deg)} }
        @keyframes ballCaptured { 0%{opacity:1;transform:translate(-50%,-50%) scale(1)} 50%{filter:brightness(3)} 100%{transform:translate(-50%,-50%) scale(.8)} }
        @keyframes ballBreak { 0%{transform:translate(-50%,-50%) scale(1)} 40%{transform:translate(-50%,-50%) scale(1.4) rotate(20deg);filter:brightness(2)} 100%{transform:translate(-50%,-50%) scale(0);opacity:0} }
        @keyframes fire-up { 0%{transform:translateY(0);opacity:0} 10%{opacity:.6} 100%{transform:translateY(-110vh);opacity:0} }
        @keyframes rageEdge { 0%,100%{opacity:.25} 50%{opacity:.45} }
        @keyframes divineRing { 0%{transform:translate(-50%,-50%) rotate(0) scale(1)} 100%{transform:translate(-50%,-50%) rotate(360deg) scale(1)} }
      `}</style>
    </div>
  );
}

/* ── Particles ───────────────────────────────────────────────────── */
function Particles({ phase }: { phase: BossPhase }) {
  const count = phase === "divine" ? 50 : phase === "rage" ? 35 : 20;
  const ps = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, left: Math.random() * 100,
    delay: Math.random() * 6, dur: 5 + Math.random() * 8,
    size: phase === "divine" ? 2 + Math.random() * 6 : 2 + Math.random() * 4,
    op: 0.2 + Math.random() * 0.4,
    color: phase === "divine" ? ["#fbbf24","#fff","#f59e0b","#fef3c7"][i%4]
         : phase === "rage"   ? ["#ef4444","#dc2626","#f97316","#b91c1c"][i%4]
         : ["#f59e0b","#ef4444","#fbbf24"][i%3],
  })), [phase, count]);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {ps.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, bottom: "-3%", width: p.size, height: p.size,
          backgroundColor: p.color, boxShadow: `0 0 ${p.size*2}px ${p.color}`,
          opacity: p.op, animation: `fire-up ${p.dur}s ${p.delay}s infinite linear`,
        }} />
      ))}
    </div>
  );
}

function DivineRings() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {[200, 300, 420].map((r, i) => (
        <div key={i} className="absolute rounded-full border"
          style={{
            width: r, height: r, top: "50%", left: "50%",
            borderColor: `rgba(251,191,36,${0.08 - i*0.02})`,
            animation: `divineRing ${12+i*4}s linear infinite ${i%2===0 ? "" : "reverse"}`,
          }} />
      ))}
    </div>
  );
}

function RageEdge() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0"
      style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(180,0,0,0.28) 100%)", animation: "rageEdge 2s ease-in-out infinite" }} />
  );
}

/* ── Phase Transition (Elden Ring style) ─────────────────────────── */
function PhaseTransitionOverlay({ phase }: { phase: BossPhase }) {
  const DATA = {
    rage:   { title: "COLÈRE ARDENTE", sub: "HO-OH ressuscite en Rage…",      color: "#ef4444", bg: "rgba(20,0,0,.96)",   icon: "🔥", roman: "PHASE II" },
    divine: { title: "JUGEMENT DIVIN", sub: "Un pouvoir au-delà des dieux…",  color: "#fbbf24", bg: "rgba(5,4,0,.97)",    icon: "✦",  roman: "PHASE III — FINALE" },
    sacred: { title: "",               sub: "",                                color: "#f59e0b", bg: "transparent",        icon: "",   roman: "" },
  };
  const d = DATA[phase];
  if (!d.title) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.8 } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: d.bg, fontFamily: "'Courier New', monospace" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 18 }, (_, i) => (
          <motion.div key={i} initial={{ y: "110%", x: `${Math.random() * 100}%`, opacity: 0 }}
            animate={{ y: "-10%", opacity: [0, 0.6, 0] }}
            transition={{ duration: 3 + Math.random() * 3, delay: Math.random() * 2, repeat: Infinity }}
            className="absolute rounded-full"
            style={{ width: 2 + Math.random() * 4, height: 2 + Math.random() * 4, background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
        ))}
      </div>
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
        className="absolute w-full h-px" style={{ background: `linear-gradient(90deg,transparent,${d.color}60,transparent)`, top: "42%" }} />
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.3 }}
        className="absolute w-full h-px" style={{ background: `linear-gradient(90deg,transparent,${d.color}40,transparent)`, bottom: "42%" }} />
      <div className="relative z-10 text-center px-8 max-w-lg">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-xs tracking-[0.5em] uppercase font-bold mb-3"
          style={{ color: `${d.color}80` }}>{d.roman}</motion.p>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }}
          className="text-4xl mb-3">{d.icon}</motion.div>
        <motion.h1 initial={{ opacity: 0, letterSpacing: "0.8em" }} animate={{ opacity: 1, letterSpacing: "0.15em" }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="font-black text-3xl sm:text-4xl mb-3"
          style={{ color: d.color, textShadow: `0 0 40px ${d.color}80, 0 0 80px ${d.color}30` }}>
          {d.title}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="text-sm italic" style={{ color: `${d.color}60` }}>{d.sub}</motion.p>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.8 }}
          className="h-0.5 mx-auto mt-4 rounded-full"
          style={{ width: "60%", background: `linear-gradient(90deg,transparent,${d.color},transparent)` }} />
      </div>
      {phase === "divine" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.2, 0, 0.12, 0] }}
          transition={{ duration: 1.5, delay: 0.8 }}
          className="absolute inset-0 pointer-events-none"
          style={{ background: "rgba(251,191,36,1)" }} />
      )}
    </motion.div>
  );
}

/* ── Team Select ─────────────────────────────────────────────────── */
function TeamSelect({ team, onSelect, pseudo }: { team: TeamMember[]; onSelect: (i: number) => void; pseudo: string }) {
  return (
    <div className="h-dvh w-full p-4 overflow-auto" style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 25%,#2d1208,#0a0400)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-4" style={{ boxShadow: "6px 6px 0 #000" }}>
          <h1 className="text-sm font-black text-black">Boss Final : HO-OH — 3 Phases</h1>
          <p className="text-[10px] text-gray-500">{pseudo} · {MAX_POKEBALLS} Pokéballs · Choisis ton lead</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {team.map((m, i) => (
            <button key={i} disabled={m.fainted} onClick={() => onSelect(i)}
              className="bg-[#f8f0e0] border-4 border-black p-3 text-left disabled:opacity-30 hover:bg-[#ffe080] transition-colors"
              style={{ boxShadow: m.fainted ? "none" : "4px 4px 0 #000" }}>
              <div className="flex items-center justify-center h-16">
                {m.data.spriteAnimated
                  ? <img src={m.data.spriteAnimated} alt="" style={{ imageRendering: "pixelated", height: "55px" }} />
                  : <img src={m.data.sprite} alt="" style={{ height: "55px" }} />}
              </div>
              <div className="text-[11px] font-black text-black">{m.pokemon.name.toUpperCase()}</div>
              <div className="text-[9px] text-gray-500">Niv.100 · {m.evSpread.name}</div>
              <div className="text-[9px] font-bold text-black">{m.currentHP}/{m.maxHP} PV</div>
              {m.item.effect !== "none" && <div className="text-[8px] text-gray-500">{m.item.emoji} {m.item.name}</div>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Switch Select ───────────────────────────────────────────────── */
function SwitchSelect({ team, onSelect }: { team: TeamMember[]; onSelect: (i: number) => void }) {
  return (
    <div className="h-dvh w-full p-4 overflow-auto" style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 25%,#2d1208,#0a0400)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-4" style={{ boxShadow: "6px 6px 0 #000" }}>
          <h1 className="text-sm font-black text-black">Pokémon K.O. — Qui envoyer ?</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {team.map((m, i) => (
            <button key={i} disabled={m.fainted} onClick={() => onSelect(i)}
              className="bg-[#f8f0e0] border-4 border-black p-3 text-left disabled:opacity-30 hover:bg-[#ffe080]"
              style={{ boxShadow: m.fainted ? "none" : "4px 4px 0 #000" }}>
              <div className="flex items-center justify-center h-12">
                {m.data.spriteAnimated
                  ? <img src={m.data.spriteAnimated} alt="" style={{ imageRendering: "pixelated", height: "44px" }} />
                  : <img src={m.data.sprite} alt="" style={{ height: "44px" }} />}
              </div>
              <div className="text-[10px] font-black text-black">{m.pokemon.name.toUpperCase()}</div>
              <div className="text-[9px] font-bold" style={{ color: m.fainted ? "#ef4444" : "#22c55e" }}>
                {m.fainted ? "K.O." : `${m.currentHP}/${m.maxHP}`}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Result Screen ───────────────────────────────────────────────── */
function ResultScreen({ type, pseudo, onClose }: { type: "victory" | "defeat" | "fled"; pseudo: string; onClose: () => void }) {
  const M = {
    victory: { t: "HO-OH CAPTURÉ !", txt: `Incroyable ${pseudo} !`,       c: "#fbbf24", e: "🌈" },
    defeat:  { t: "DÉFAITE…",        txt: "Ses flammes t'ont consumé…",    c: "#ef4444", e: "💀" },
    fled:    { t: "VICTOIRE !",      txt: `${pseudo} a terrassé Ho-Oh !`,  c: "#fbbf24", e: "🌈" },
  }[type];
  useEffect(() => { const t = setTimeout(onClose, 8000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="h-dvh w-full flex items-center justify-center p-6 overflow-hidden"
      style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 40%,#2d1208,#0a0400)" }}>
      {type !== "defeat" && <Particles phase="divine" />}
      <motion.div initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm w-full text-center relative z-10"
        style={{ boxShadow: type !== "defeat" ? "8px 8px 0 #000, 0 0 40px rgba(251,191,36,.3)" : "8px 8px 0 #000" }}>
        <motion.div className="text-5xl mb-4"
          animate={type !== "defeat" ? { rotate: [0,10,-10,0], scale: [1,1.2,1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}>
          {M.e}
        </motion.div>
        <h1 className="text-2xl font-black mb-3" style={{ color: M.c }}>{M.t}</h1>
        <p className="text-sm text-black mb-6">{M.txt}</p>
        <button onClick={onClose} className="bg-black text-white px-6 py-3 text-sm font-black hover:bg-gray-800">FERMER</button>
      </motion.div>
    </div>
  );
}