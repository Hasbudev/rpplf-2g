"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { fetchPlayers, REQUIRED_BADGES, type Player, type PlayerPokemon } from "../lib/playerRoster";
import { fetchPokemonData, type PokemonData } from "../lib/pokeApi";
import {
  calculateDamage, calculateMaxHP, calculateCaptureRate,
  getEffectiveness, pickMovesForPokemon,
  RAIKOU_MOVES, TYPE_COLORS,
  canMoveWithParalysis, burnDamage, poisonDamage,
  type Move, type PokemonType, type StatusState,
} from "../lib/battleSystem";
import { updateLiveBattle } from "../hooks/useEvent";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const RAIKOU_LEVEL = 70;
const RAIKOU_MAX_HP = 210;
const RAIKOU_TYPES: PokemonType[] = ["Électrik"];
const MAX_POKEBALLS = 3;

type Phase = "loading" | "not_found" | "not_enough_badges" | "team_select" | "battle" | "switch_pokemon" | "victory" | "defeat" | "fled";

interface TeamMember {
  pokemon: PlayerPokemon;
  data: PokemonData;
  currentHP: number;
  maxHP: number;
  fainted: boolean;
  moves: Move[];
  status: StatusState;
}

interface BattleState {
  raikouHP: number;
  raikouMaxHP: number;
  raikouStatus: StatusState;
  pokeballsLeft: number;
  log: string[];
  busy: boolean;
}

export function RaikouBattle({ pseudo, onComplete }: { pseudo: string; onComplete: (won: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const teamRef = useRef<TeamMember[]>([]);
  useEffect(() => { teamRef.current = team; }, [team]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [battle, setBattle] = useState<BattleState>({
    raikouHP: RAIKOU_MAX_HP, raikouMaxHP: RAIKOU_MAX_HP,
    raikouStatus: { status: null },
    pokeballsLeft: MAX_POKEBALLS, log: [], busy: false,
  });
  const [menuMode, setMenuMode] = useState<"main" | "moves">("main");
  const [ballAnim, setBallAnim] = useState<"idle" | "throwing" | "shaking" | "success" | "fail">("idle");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Music control — keep playing across battle/switch_pokemon, only stop on end states
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const shouldPlay =
      (phase === "battle" || phase === "switch_pokemon") && musicEnabled;
    if (shouldPlay) {
      audio.volume = 0.3;
      audio.loop = true;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [phase, musicEnabled]);

  // Helper to broadcast live state
  const broadcastLive = useCallback((extra?: Partial<{ status: "in_battle" | "victory" | "defeat" | "fled"; lastAction: string }>) => {
    const active = teamRef.current[activeIdx];
    updateLiveBattle({
      pseudo,
      pokemon: "raikou",
      currentPokemon: active?.pokemon.name || null,
      currentPokemonHP: active?.currentHP,
      currentPokemonMaxHP: active?.maxHP,
      raikouHP: battle.raikouHP,
      raikouMaxHP: battle.raikouMaxHP,
      pokeballsLeft: battle.pokeballsLeft,
      status: extra?.status || "in_battle",
      lastAction: extra?.lastAction || "",
    });
  }, [pseudo, activeIdx, battle]);

  // Load player
  useEffect(() => {
    (async () => {
      const players = await fetchPlayers();
      const found = players.find((p) => p.name.toLowerCase() === pseudo.toLowerCase());
      if (!found) {
        setPhase("not_found");
        return;
      }
      setPlayer(found);
      if (found.badges < REQUIRED_BADGES) {
        setPhase("not_enough_badges");
        return;
      }
      const teamData: TeamMember[] = [];
      for (const p of found.team) {
        const data = await fetchPokemonData(p.name);
        if (data) {
          const maxHP = calculateMaxHP(p.level, data.baseHP);
          const moves = pickMovesForPokemon(data.types);
          teamData.push({
            pokemon: p, data, currentHP: maxHP, maxHP, fainted: false,
            moves, status: { status: null },
          });
        }
      }
      setTeam(teamData);
      setPhase("team_select");
    })();
  }, [pseudo]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const startBattle = useCallback((idx: number) => {
    setActiveIdx(idx);
    setBattle({
      raikouHP: RAIKOU_MAX_HP, raikouMaxHP: RAIKOU_MAX_HP,
      raikouStatus: { status: null },
      pokeballsLeft: MAX_POKEBALLS,
      log: [`Un RAIKOU sauvage apparaît !`, `Allez ${team[idx].pokemon.name.toUpperCase()} !`],
      busy: false,
    });
    setPhase("battle");
    // Initial broadcast
    setTimeout(() => {
      updateLiveBattle({
        pseudo,
        pokemon: "raikou",
        currentPokemon: team[idx].pokemon.name,
        currentPokemonHP: team[idx].currentHP,
        currentPokemonMaxHP: team[idx].maxHP,
        raikouHP: RAIKOU_MAX_HP,
        raikouMaxHP: RAIKOU_MAX_HP,
        pokeballsLeft: MAX_POKEBALLS,
        status: "in_battle",
        lastAction: "Combat commencé",
      });
    }, 100);
  }, [team, pseudo]);

  const switchPokemon = useCallback((idx: number) => {
    setActiveIdx(idx);
    setBattle((b) => ({
      ...b,
      log: [`Allez ${team[idx].pokemon.name.toUpperCase()} !`, "Que voulez-vous faire ?"],
      busy: false,
    }));
    setPhase("battle");
    setMenuMode("main");
  }, [team]);

  const applyStatusDamage = useCallback(async (member: TeamMember, idx: number) => {
    const s = member.status.status;
    if (s === "burn") {
      const dmg = burnDamage(member.maxHP);
      const newHP = Math.max(0, member.currentHP - dmg);
      setTeam((prev) => prev.map((m, i) => i === idx ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
      setBattle((b) => ({ ...b, log: [...b.log, `${member.pokemon.name.toUpperCase()} souffre de sa brûlure ! -${dmg} PV`] }));
      await sleep(900);
      return newHP <= 0;
    }
    if (s === "poison") {
      const dmg = poisonDamage(member.maxHP);
      const newHP = Math.max(0, member.currentHP - dmg);
      setTeam((prev) => prev.map((m, i) => i === idx ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
      setBattle((b) => ({ ...b, log: [...b.log, `${member.pokemon.name.toUpperCase()} souffre du poison ! -${dmg} PV`] }));
      await sleep(900);
      return newHP <= 0;
    }
    return false;
  }, []);

  /* ═══════════════════════════════════════════════
     SMART RAIKOU AI — picks best move based on opponent
     ═══════════════════════════════════════════════ */
  const pickRaikouMove = useCallback((opponent: TeamMember): Move => {
    // Check if opponent is immune to electric (Ground type)
    const electricEff = getEffectiveness("Électrik", opponent.data.types);

    // If immune to electric, MUST use Ébullition (water move)
    if (electricEff === 0) {
      const scald = RAIKOU_MOVES.find((m: Move) => m.name === "Ébullition");
      if (scald) return scald;
    }

    // Otherwise pick a damaging move at random (avoid Cage-Éclair if opponent already paralyzed)
    const damagingMoves = RAIKOU_MOVES.filter((m: Move) => {
      if (m.power === 0) {
        // Status move: only use if opponent isn't already statused
        return opponent.status.status === null && !opponent.data.types.includes("Électrik");
      }
      return true;
    });

    if (damagingMoves.length === 0) {
      // Fallback: any move
      return RAIKOU_MOVES[Math.floor(Math.random() * RAIKOU_MOVES.length)];
    }

    return damagingMoves[Math.floor(Math.random() * damagingMoves.length)];
  }, []);

  // Returns true if the player pokemon was KO'd (so the caller stops chaining)
  const raikouAttack = useCallback(async (active: TeamMember, chainNext: boolean = false): Promise<boolean> => {
    if (battle.raikouStatus.status === "paralysis" && !canMoveWithParalysis()) {
      setBattle((b) => ({ ...b, log: ["RAIKOU est paralysé ! Il ne peut pas attaquer…"] }));
      await sleep(1200);
      if (!chainNext) {
        setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      }
      return false;
    }

    const raikouMove = pickRaikouMove(active);
    const eff = getEffectiveness(raikouMove.type, active.data.types);
    const isStab = RAIKOU_TYPES.includes(raikouMove.type);
    const damage = calculateDamage(RAIKOU_LEVEL, raikouMove.power, eff, isStab);

    setBattle((b) => ({ ...b, log: [`RAIKOU utilise ${raikouMove.name} !`] }));
    await sleep(900);

    // Status-only move (Cage-Éclair)
    if (raikouMove.power === 0) {
      if (active.status.status !== null) {
        setBattle((b) => ({ ...b, log: [...b.log, "Mais ça échoue !"] }));
        await sleep(1100);
      } else if (raikouMove.effect === "paralysis" && active.data.types.includes("Électrik")) {
        setBattle((b) => ({ ...b, log: [...b.log, "Mais ça n'affecte pas !"] }));
        await sleep(1100);
      } else {
        setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, status: { status: raikouMove.effect! } } : m));
        setBattle((b) => ({ ...b, log: [...b.log, `${active.pokemon.name.toUpperCase()} est paralysé !`] }));
        await sleep(1200);
      }
      if (!chainNext) {
        setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      }
      return false;
    }

    if (eff === 0) {
      setBattle((b) => ({ ...b, log: [...b.log, `Ça n'affecte pas ${active.pokemon.name.toUpperCase()} !`] }));
      await sleep(1100);
      if (!chainNext) {
        setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      }
      return false;
    }

    let effMsg = "";
    if (eff > 1) effMsg = " C'est super efficace !";
    else if (eff < 1) effMsg = " Pas très efficace…";

    const newHP = Math.max(0, active.currentHP - damage);
    setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
    setBattle((b) => ({ ...b, log: [...b.log, `${damage} dégâts !${effMsg}`] }));
    await sleep(1100);

    // Apply secondary effect
    if (raikouMove.effect && raikouMove.effectChance && Math.random() < raikouMove.effectChance && active.status.status === null) {
      const canApply =
        !(raikouMove.effect === "paralysis" && active.data.types.includes("Électrik")) &&
        !(raikouMove.effect === "burn" && active.data.types.includes("Feu"));
      if (canApply) {
        setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, status: { status: raikouMove.effect! } } : m));
        const effectName = raikouMove.effect === "burn" ? "brûlé" : raikouMove.effect === "paralysis" ? "paralysé" : raikouMove.effect;
        setBattle((b) => ({ ...b, log: [...b.log, `${active.pokemon.name.toUpperCase()} est ${effectName} !`] }));
        await sleep(1200);
      }
    }

    if (newHP <= 0) {
      setBattle((b) => ({ ...b, log: [...b.log, `${active.pokemon.name.toUpperCase()} est K.O. !`] }));
      await sleep(1500);
      const aliveCount = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted).length;
      if (aliveCount === 0) {
        setBattle((b) => ({ ...b, log: [...b.log, "Toute votre équipe est K.O. !"], busy: false }));
        updateLiveBattle({ pseudo, pokemon: "raikou", status: "defeat", lastAction: "Équipe K.O." });
        await sleep(2000);
        setPhase("defeat");
        return true;
      }
      setBattle((b) => ({ ...b, busy: false }));
      setPhase("switch_pokemon");
      return true;
    }

    if (!chainNext) {
      setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
    }
    return false;
  }, [battle.raikouStatus, activeIdx, pseudo, pickRaikouMove]);

  const playerAttack = useCallback(async (moveIndex: number) => {
    const active = teamRef.current[activeIdx];
    if (!active || battle.busy) return;
    setBattle((b) => ({ ...b, busy: true }));
    setMenuMode("main");

    // ─── RAIKOU ATTACKS FIRST (always priority over player moves) ───
    const playerKO = await raikouAttack(active, true);
    if (playerKO) return; // raikouAttack handled phase change & busy

    // Re-fetch active after raikou's hit
    const afterRaikou = teamRef.current[activeIdx];
    if (!afterRaikou || afterRaikou.fainted || afterRaikou.currentHP <= 0) return;

    // ─── PLAYER ATTACKS SECOND ───
    if (afterRaikou.status.status === "paralysis" && !canMoveWithParalysis()) {
      setBattle((b) => ({ ...b, log: [...b.log, `${afterRaikou.pokemon.name.toUpperCase()} est paralysé ! Il ne peut pas bouger…`] }));
      await sleep(1400);
      setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      return;
    }

    const move = afterRaikou.moves[moveIndex];
    const isStab = afterRaikou.data.types.includes(move.type);
    const eff = getEffectiveness(move.type, RAIKOU_TYPES);
    const damage = calculateDamage(afterRaikou.pokemon.level, move.power, eff, isStab);

    setBattle((b) => ({ ...b, log: [...b.log, `${afterRaikou.pokemon.name.toUpperCase()} utilise ${move.name} !`] }));
    await sleep(900);

    if (eff === 0) {
      setBattle((b) => ({ ...b, log: [...b.log, "Ça n'affecte pas RAIKOU !"] }));
      await sleep(1100);
      setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
      return;
    }

    let effMsg = "";
    if (eff > 1) effMsg = " C'est super efficace !";
    else if (eff < 1) effMsg = " Pas très efficace…";

    const newRaikouHP = Math.max(0, battle.raikouHP - damage);
    setBattle((b) => ({ ...b, raikouHP: newRaikouHP, log: [...b.log, `${damage} dégâts !${effMsg}`] }));

    updateLiveBattle({
      pseudo,
      pokemon: "raikou",
      currentPokemon: afterRaikou.pokemon.name,
      currentPokemonHP: afterRaikou.currentHP,
      currentPokemonMaxHP: afterRaikou.maxHP,
      raikouHP: newRaikouHP,
      raikouMaxHP: battle.raikouMaxHP,
      pokeballsLeft: battle.pokeballsLeft,
      status: "in_battle",
      lastAction: `${afterRaikou.pokemon.name} → ${move.name} (${damage} dmg)`,
    });

    await sleep(1100);

    if (move.power > 0 && move.effect && move.effectChance && Math.random() < move.effectChance && battle.raikouStatus.status === null) {
      const canApply =
        !(move.effect === "paralysis" && RAIKOU_TYPES.includes("Électrik")) &&
        !(move.effect === "burn" && (RAIKOU_TYPES as string[]).includes("Feu"));
      if (canApply) {
        setBattle((b) => ({ ...b, raikouStatus: { status: move.effect! }, log: [...b.log, `RAIKOU est ${move.effect === "burn" ? "brûlé" : move.effect === "paralysis" ? "paralysé" : move.effect} !`] }));
        await sleep(1200);
      }
    }

    if (newRaikouHP <= 0) {
      setBattle((b) => ({ ...b, log: [...b.log, "RAIKOU est K.O. ! Il s'enfuit dans la nuit…"], busy: false }));
      updateLiveBattle({ pseudo, pokemon: "raikou", status: "fled", lastAction: "Raikou K.O." });
      await sleep(2200);
      setPhase("fled");
      return;
    }

    // End-of-turn status damage on player
    const current = teamRef.current[activeIdx];
    if (current && !current.fainted && (current.status.status === "burn" || current.status.status === "poison")) {
      const ko = await applyStatusDamage(current, activeIdx);
      if (ko) {
        setBattle((b) => ({ ...b, log: [...b.log, `${current.pokemon.name.toUpperCase()} est K.O. !`] }));
        await sleep(1500);
        const aliveCount = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted).length;
        if (aliveCount === 0) {
          setBattle((b) => ({ ...b, log: [...b.log, "Toute votre équipe est K.O. !"], busy: false }));
          updateLiveBattle({ pseudo, pokemon: "raikou", status: "defeat", lastAction: "Équipe K.O." });
          await sleep(2000);
          setPhase("defeat");
          return;
        }
        setBattle((b) => ({ ...b, busy: false }));
        setPhase("switch_pokemon");
        return;
      }
    }

    setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
  }, [activeIdx, battle, raikouAttack, applyStatusDamage, pseudo]);

  const throwPokeball = useCallback(async () => {
    const active = teamRef.current[activeIdx];
    if (!active || battle.busy || battle.pokeballsLeft <= 0) return;
    setBattle((b) => ({ ...b, busy: true }));

    const hpPercent = battle.raikouHP / battle.raikouMaxHP;
    const captureRate = calculateCaptureRate(hpPercent);
    const success = Math.random() < captureRate;

    setBattle((b) => ({ ...b, pokeballsLeft: b.pokeballsLeft - 1, log: ["Vous lancez une POKÉBALL !"] }));

    updateLiveBattle({
      pseudo,
      pokemon: "raikou",
      currentPokemon: active.pokemon.name,
      currentPokemonHP: active.currentHP,
      currentPokemonMaxHP: active.maxHP,
      raikouHP: battle.raikouHP,
      raikouMaxHP: battle.raikouMaxHP,
      pokeballsLeft: battle.pokeballsLeft - 1,
      status: "in_battle",
      lastAction: `Lance une Pokéball !`,
    });

    setBallAnim("throwing");
    await sleep(900);
    setBallAnim("shaking");
    setBattle((b) => ({ ...b, log: [...b.log, "La Pokéball tremble…"] }));
    await sleep(2400);

    if (success) {
      setBallAnim("success");
      setBattle((b) => ({ ...b, log: [...b.log, "Et... RAIKOU a été capturé !"] }));
      updateLiveBattle({ pseudo, pokemon: "raikou", status: "victory", lastAction: "RAIKOU CAPTURÉ !" });
      await sleep(2400);
      setPhase("victory");
      return;
    }

    setBallAnim("fail");
    setBattle((b) => ({ ...b, log: [...b.log, "Oh non ! RAIKOU s'est échappé !"] }));
    await sleep(1500);
    setBallAnim("idle");

    if (battle.pokeballsLeft - 1 <= 0) {
      setBattle((b) => ({ ...b, log: [...b.log, "Plus de POKÉBALLS !"], busy: false }));
      updateLiveBattle({ pseudo, pokemon: "raikou", status: "defeat", lastAction: "Plus de Pokéballs" });
      await sleep(2000);
      setPhase("defeat");
      return;
    }

    await raikouAttack(active, false);
  }, [activeIdx, battle, raikouAttack, pseudo]);

  /* ─── RENDER ─── */
  // Audio element is rendered in EVERY phase so the music persists across
  // team_select → battle → switch_pokemon transitions without restarting.
  const audioEl = (
    <audio ref={audioRef} src={`${BASE_PATH}/audio/raikou-theme.mp3`} preload="auto" />
  );

  if (phase === "loading") return <>{audioEl}<LoadingScreen /></>;
  if (phase === "not_found") return <>{audioEl}<NotFoundScreen pseudo={pseudo} onClose={() => onComplete(false)} /></>;
  if (phase === "not_enough_badges" && player) return <>{audioEl}<NotEnoughBadgesScreen pseudo={pseudo} badges={player.badges} onClose={() => onComplete(false)} /></>;
  if (phase === "team_select") return <>{audioEl}<TeamSelect team={team} onSelect={startBattle} title="Choisis ton premier Pokémon" subtitle={`Dresseur ${pseudo} · ${player?.badges}/${REQUIRED_BADGES} badges`} musicEnabled={musicEnabled} setMusicEnabled={setMusicEnabled} /></>;
  if (phase === "switch_pokemon") return <>{audioEl}<TeamSelect team={team} onSelect={switchPokemon} title="Choisis ton prochain Pokémon" subtitle="Pokémon K.O. — fais ton choix !" excludeFainted /></>;
  if (phase === "victory") return <>{audioEl}<ResultScreen type="victory" pseudo={pseudo} onClose={() => onComplete(true)} /></>;
  if (phase === "defeat") return <>{audioEl}<ResultScreen type="defeat" pseudo={pseudo} onClose={() => onComplete(false)} /></>;
  if (phase === "fled") return <>{audioEl}<ResultScreen type="fled" pseudo={pseudo} onClose={() => onComplete(false)} /></>;

  return (
    <>
      {audioEl}
      <BattleScreen
        battle={battle}
        team={team}
        activeIdx={activeIdx}
        menuMode={menuMode}
        setMenuMode={setMenuMode}
        onAttack={playerAttack}
        onCatch={throwPokeball}
        ballAnim={ballAnim}
        musicEnabled={musicEnabled}
        toggleMusic={() => setMusicEnabled((m) => !m)}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════ */

function LoadingScreen() {
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#0a0518]">
      <div className="text-center" style={{ fontFamily: "'Courier New', monospace" }}>
        <div className="text-yellow-400 text-2xl font-bold mb-2 animate-pulse">⚡</div>
        <p className="text-yellow-200/60 text-sm">Chargement des données…</p>
      </div>
    </div>
  );
}

function NotFoundScreen({ pseudo, onClose }: { pseudo: string; onClose: () => void }) {
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#0a0518] p-6" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="bg-[#f8f0e0] border-4 border-black p-6 max-w-sm text-center" style={{ boxShadow: "6px 6px 0 #000" }}>
        <h2 className="text-xl font-bold text-black mb-3">DRESSEUR INTROUVABLE</h2>
        <p className="text-sm text-gray-700 mb-4">Le pseudo <strong className="text-black">{pseudo}</strong> n'est pas dans la liste de la saison 2G.</p>
        <p className="text-xs text-gray-500 mb-4">Vérifie l'orthographe et réessaie.</p>
        <button onClick={onClose} className="bg-black text-white px-4 py-2 text-sm font-bold hover:bg-gray-800">RETOUR</button>
      </div>
    </div>
  );
}

function NotEnoughBadgesScreen({ pseudo, badges, onClose }: { pseudo: string; badges: number; onClose: () => void }) {
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#0a0518] p-6" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="bg-[#f8f0e0] border-4 border-black p-6 max-w-md text-center" style={{ boxShadow: "6px 6px 0 #000" }}>
        <div className="text-4xl mb-3">🏆</div>
        <h2 className="text-xl font-bold text-black mb-3">PAS ASSEZ DE BADGES</h2>
        <p className="text-sm text-gray-700 mb-4">
          Salut <strong className="text-black">{pseudo}</strong> ! Pour défier RAIKOU il te faut <strong className="text-black">{REQUIRED_BADGES} badges</strong>.
        </p>
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: REQUIRED_BADGES }).map((_, i) => (
            <div key={i} className="w-10 h-10 border-2 border-black flex items-center justify-center font-bold" style={{
              background: i < badges ? "#fbbf24" : "#e5e5e5",
              color: i < badges ? "#000" : "#999",
            }}>{i < badges ? "✓" : "—"}</div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mb-4">Tu as <strong className="text-black">{badges}/{REQUIRED_BADGES}</strong> badges. Continue ton aventure !</p>
        <button onClick={onClose} className="bg-black text-white px-4 py-2 text-sm font-bold hover:bg-gray-800">RETOUR</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */

function TeamSelect({ team, onSelect, title, subtitle, excludeFainted, musicEnabled, setMusicEnabled }: {
  team: TeamMember[]; onSelect: (idx: number) => void;
  title: string; subtitle?: string; excludeFainted?: boolean;
  musicEnabled?: boolean; setMusicEnabled?: (v: boolean) => void;
}) {
  return (
    <div className="h-dvh w-full bg-[#0a0518] p-4 sm:p-8 overflow-auto" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-6 flex items-start justify-between gap-4" style={{ boxShadow: "6px 6px 0 #000" }}>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-black mb-1">{title}</h1>
            {subtitle && <p className="text-xs text-gray-700">{subtitle}</p>}
          </div>
          {setMusicEnabled && (
            <button
              onClick={() => setMusicEnabled(!musicEnabled)}
              className="border-2 border-black bg-white px-2 py-1 text-xs font-bold flex-shrink-0"
              style={{ boxShadow: "2px 2px 0 #000" }}
            >
              {musicEnabled ? "🔊 ON" : "🔇 OFF"}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {team.map((member, i) => {
            const disabled = excludeFainted && member.fainted;
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                disabled={disabled}
                onClick={() => !disabled && onSelect(i)}
                className="bg-[#f8f0e0] border-4 border-black p-3 hover:bg-[#ffe080] transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: "4px 4px 0 #000", filter: disabled ? "grayscale(1)" : undefined }}
              >
                <div className="flex items-center justify-center h-20 mb-2">
                  {member.data.spriteAnimated ? (
                    <img src={member.data.spriteAnimated} alt={member.pokemon.name} style={{ imageRendering: "pixelated", height: "70px" }} />
                  ) : member.data.sprite ? (
                    <img src={member.data.sprite} alt={member.pokemon.name} style={{ height: "70px" }} />
                  ) : <div className="text-xs text-gray-400">…</div>}
                </div>
                <div className="text-sm font-bold text-black">{member.pokemon.name.toUpperCase()}</div>
                <div className="text-xs text-gray-700">Niv. {member.pokemon.level}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] font-bold text-black">PV</span>
                  <div className="flex-1 h-1.5 bg-black border border-black" style={{ padding: "1px" }}>
                    <div style={{
                      width: `${(member.currentHP / member.maxHP) * 100}%`,
                      height: "100%",
                      background: member.fainted ? "#999" : (member.currentHP / member.maxHP) > 0.5 ? "#22c55e" : (member.currentHP / member.maxHP) > 0.2 ? "#f59e0b" : "#ef4444",
                    }} />
                  </div>
                </div>
                <div className="text-[9px] text-black font-bold mt-1">{member.fainted ? "K.O." : `${member.currentHP}/${member.maxHP}`}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {member.data.types.map((t) => (
                    <span key={t} className="text-[8px] px-1 py-0.5 text-white font-bold" style={{ background: TYPE_COLORS[t] }}>{t}</span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ */

function StatusBadge({ status }: { status: StatusState["status"] }) {
  if (!status) return null;
  const map: Record<string, { label: string; color: string }> = {
    paralysis: { label: "PAR", color: "#eab308" },
    burn: { label: "BRL", color: "#dc2626" },
    poison: { label: "PSN", color: "#a855f7" },
    freeze: { label: "GEL", color: "#22d3ee" },
    sleep: { label: "SOM", color: "#94a3b8" },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 border border-black" style={{ background: s.color, color: "#fff" }}>
      {s.label}
    </span>
  );
}

function BattleScreen({ battle, team, activeIdx, menuMode, setMenuMode, onAttack, onCatch, ballAnim, musicEnabled, toggleMusic }: {
  battle: BattleState; team: TeamMember[]; activeIdx: number;
  menuMode: "main" | "moves"; setMenuMode: (m: "main" | "moves") => void;
  onAttack: (i: number) => void; onCatch: () => void;
  ballAnim: "idle" | "throwing" | "shaking" | "success" | "fail";
  musicEnabled: boolean; toggleMusic: () => void;
}) {
  const active = team[activeIdx];
  if (!active) return null;

  const moves = active.moves;
  const primaryType = active.data.types[0] || "Normal";
  const raikouHpPercent = (battle.raikouHP / battle.raikouMaxHP) * 100;
  const playerHpPercent = (active.currentHP / active.maxHP) * 100;
  const captureRatePercent = (calculateCaptureRate(raikouHpPercent / 100) * 100).toFixed(1);
  const captureColor = raikouHpPercent >= 50 ? "#22c55e" : raikouHpPercent >= 20 ? "#f59e0b" : "#ef4444";
  const hpBarColor = (pct: number) => pct > 50 ? "#22c55e" : pct > 20 ? "#f59e0b" : "#ef4444";
  const raikouHidden = ballAnim === "throwing" || ballAnim === "shaking" || ballAnim === "success";

  return (
    <div className="h-dvh w-full flex flex-col" style={{ fontFamily: "'Courier New', monospace", background: "#0a0518" }}>
      <div className="relative flex-1 overflow-hidden" style={{
        background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 35%, #4a2d6e 70%, #5a3878 100%)",
        minHeight: "55%",
      }}>
        <div className="absolute inset-0 opacity-50">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: i % 4 === 0 ? "3px" : "2px", height: i % 4 === 0 ? "3px" : "2px",
              background: i % 3 === 0 ? "#fbbf24" : "#fff",
              top: `${Math.random() * 50}%`, left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.3,
              boxShadow: i % 4 === 0 ? "0 0 4px currentColor" : undefined,
            }} />
          ))}
        </div>

        <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 320 100" preserveAspectRatio="none" style={{ height: "35%" }}>
          <path d="M 0 100 L 0 65 L 25 40 L 50 55 L 80 25 L 110 50 L 140 30 L 175 50 L 210 25 L 240 50 L 275 30 L 305 45 L 320 35 L 320 100 Z" fill="#1a0f30" opacity="0.7" />
          <path d="M 0 100 L 0 75 L 30 55 L 60 70 L 100 50 L 140 70 L 180 55 L 220 70 L 260 50 L 300 65 L 320 60 L 320 100 Z" fill="#0a0520" />
        </svg>

        <div className="absolute left-1/2 -translate-x-1/2" style={{
          bottom: "20%", width: "200px", height: "20px",
          background: "radial-gradient(ellipse, rgba(251, 191, 36, 0.3), transparent 70%)",
          filter: "blur(8px)",
        }} />

        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 z-20 max-w-[55%]" style={{ boxShadow: "4px 4px 0 #000" }}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] sm:text-sm font-bold text-black truncate">RAIKOU</span>
              <StatusBadge status={battle.raikouStatus.status} />
            </div>
            <span className="text-[10px] text-gray-700 flex-shrink-0">Niv. ?</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="flex-1 h-2 bg-black border border-black" style={{ padding: "1px", minWidth: "100px" }}>
              <div style={{
                width: `${raikouHpPercent}%`, height: "100%",
                background: hpBarColor(raikouHpPercent), transition: "width 0.5s",
                boxShadow: `0 0 4px ${hpBarColor(raikouHpPercent)}`,
              }} />
            </div>
          </div>
          <div className="text-[9px] text-gray-700 mt-1 flex items-center gap-1">
            Capture: <span className="font-bold text-[10px]" style={{ color: captureColor }}>{captureRatePercent}%</span>
          </div>
        </div>

        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          animate={raikouHidden ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
            width: "240px", height: "240px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 75%)",
            filter: "blur(20px)",
            animation: "auraPulse 2.5s ease-in-out infinite",
          }} />
          <img
            src="https://play.pokemonshowdown.com/sprites/ani/raikou.gif"
            alt="Raikou"
            style={{
              imageRendering: "pixelated", width: "min(180px, 35vw)",
              filter: "drop-shadow(0 0 16px rgba(253, 224, 71, 0.6))",
              position: "relative",
              animation: "raikouFloat 3s ease-in-out infinite",
            }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </motion.div>

        {ballAnim !== "idle" && (
          <div className="absolute z-30 pointer-events-none" style={{
            top: "50%", left: "50%", width: "48px", height: "48px",
            transform: "translate(-50%, -50%)",
            animation:
              ballAnim === "throwing" ? "ballThrow 0.9s cubic-bezier(0.4, 0, 0.6, 1) forwards" :
              ballAnim === "shaking" ? "ballShake 0.6s ease-in-out infinite" :
              ballAnim === "success" ? "ballCaptured 1.2s ease-out forwards" :
              ballAnim === "fail" ? "ballBreak 1.2s ease-out forwards" : undefined,
          }}>
            <PokeballSVG />
          </div>
        )}

        <motion.div className="absolute z-10" style={{ bottom: "12%", left: "8%" }} animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          {active.data.spriteAnimated ? (
            <img src={active.data.spriteAnimated} alt={active.pokemon.name} style={{ imageRendering: "pixelated", width: "min(120px, 25vw)", transform: "scaleX(-1)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }} />
          ) : active.data.sprite ? (
            <img src={active.data.sprite} alt={active.pokemon.name} style={{ width: "min(120px, 25vw)", transform: "scaleX(-1)" }} />
          ) : null}
        </motion.div>

        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 z-20 max-w-[55%]" style={{ boxShadow: "4px 4px 0 #000" }}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] sm:text-sm font-bold text-black truncate">{active.pokemon.name.toUpperCase()}</span>
              <StatusBadge status={active.status.status} />
            </div>
            <span className="text-[10px] text-gray-700 flex-shrink-0">Niv.{active.pokemon.level}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="flex-1 h-2 bg-black border border-black" style={{ padding: "1px", minWidth: "80px" }}>
              <div style={{
                width: `${playerHpPercent}%`, height: "100%",
                background: hpBarColor(playerHpPercent), transition: "width 0.5s",
                boxShadow: `0 0 4px ${hpBarColor(playerHpPercent)}`,
              }} />
            </div>
          </div>
          <div className="text-[9px] text-black font-bold mt-1 text-right">{active.currentHP}/{active.maxHP}</div>
        </div>

        {/* Pokeball counter + music toggle */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
          <button
            onClick={toggleMusic}
            className="bg-[#f8f0e0] border-[3px] border-black px-2 py-1.5 text-[10px] font-bold text-black"
            style={{ boxShadow: "3px 3px 0 #000", fontFamily: "'Courier New', monospace" }}
          >
            {musicEnabled ? "🔊" : "🔇"}
          </button>
          <div className="flex items-center gap-1.5 bg-[#f8f0e0] border-[3px] border-black px-2 py-1.5" style={{ boxShadow: "3px 3px 0 #000" }}>
            {Array.from({ length: MAX_POKEBALLS }).map((_, i) => {
              const used = i >= battle.pokeballsLeft;
              return (
                <div key={i} style={{
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: used ? "#ccc" : "linear-gradient(180deg, #ef4444 50%, #fff 50%)",
                  border: "1.5px solid #000", opacity: used ? 0.4 : 1,
                  filter: used ? "grayscale(1)" : "drop-shadow(0 0 2px rgba(251, 191, 36, 0.4))",
                }} />
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-[#f8f0e0] border-t-4 border-black" style={{ minHeight: "200px", padding: "10px 12px 12px" }}>
        <div className="bg-white border-[3px] border-black p-3 mb-2.5 relative" style={{ boxShadow: "4px 4px 0 #000", minHeight: "56px" }}>
          <div className="absolute top-1 left-1 right-1 bottom-1 border border-gray-300 pointer-events-none" />
          {battle.log.slice(-2).map((line, i) => (
            <p key={i} className="text-[13px] sm:text-sm text-black font-bold relative" style={{ lineHeight: "1.5" }}>{line}</p>
          ))}
        </div>

        {menuMode === "main" ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={battle.busy}
              onClick={() => setMenuMode("moves")}
              className="border-[3px] border-black p-3 text-sm sm:text-base font-bold disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              style={{
                boxShadow: "4px 4px 0 #000",
                fontFamily: "'Courier New', monospace",
                background: TYPE_COLORS[primaryType],
                color: "#000",
                textShadow: "1px 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              ⚔️ ATTAQUE
            </button>
            <button
              disabled={battle.busy || battle.pokeballsLeft === 0}
              onClick={onCatch}
              className="bg-white border-[3px] border-black p-3 text-sm sm:text-base font-bold text-black disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              style={{
                boxShadow: "4px 4px 0 #000",
                fontFamily: "'Courier New', monospace",
                background: "linear-gradient(180deg, #fef3c7, #fde047)",
              }}
            >
              ⚡ CAPTURE ({battle.pokeballsLeft})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {moves.map((m, i) => (
              <button
                key={i}
                disabled={battle.busy}
                onClick={() => onAttack(i)}
                className="border-[3px] border-black p-2.5 text-left disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                style={{
                  boxShadow: "4px 4px 0 #000",
                  fontFamily: "'Courier New', monospace",
                  background: TYPE_COLORS[m.type],
                  color: "#000",
                }}
              >
                <div className="text-[12px] sm:text-[13px] font-bold" style={{ textShadow: "1px 1px 0 rgba(255,255,255,0.5)" }}>{m.name.toUpperCase()}</div>
                <div className="text-[10px] text-black/70 font-bold">
                  {m.power === 0 ? "STATUT" : `PUI: ${m.power}`} · {m.type.toUpperCase()}
                </div>
              </button>
            ))}
            <button onClick={() => setMenuMode("main")} className="col-span-2 text-[11px] text-black font-bold underline mt-1">← Retour</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes raikouFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes auraPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
        }
        @keyframes ballThrow {
          0% { top: 90%; left: 15%; transform: translate(-50%, -50%) rotate(0deg) scale(0.6); }
          50% { top: 20%; left: 35%; transform: translate(-50%, -50%) rotate(360deg) scale(1.1); }
          100% { top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(720deg) scale(1); }
        }
        @keyframes ballShake {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          25% { transform: translate(-50%, -50%) rotate(-25deg); }
          75% { transform: translate(-50%, -50%) rotate(25deg); }
        }
        @keyframes ballCaptured {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; filter: brightness(2); }
          100% { transform: translate(-50%, -50%) scale(0.9); opacity: 1; filter: brightness(1); }
        }
        @keyframes ballBreak {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          30% { transform: translate(-50%, -50%) scale(1.4) rotate(20deg); opacity: 1; filter: brightness(2); }
          60% { transform: translate(-50%, -50%) scale(0.5) rotate(-30deg); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function PokeballSVG() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}>
      <circle cx="24" cy="24" r="22" fill="#fff" stroke="#000" strokeWidth="3"/>
      <path d="M 2 24 A 22 22 0 0 1 46 24 L 2 24 Z" fill="#ef4444" stroke="#000" strokeWidth="3"/>
      <line x1="2" y1="24" x2="46" y2="24" stroke="#000" strokeWidth="3"/>
      <circle cx="24" cy="24" r="6" fill="#fff" stroke="#000" strokeWidth="3"/>
      <circle cx="24" cy="24" r="2.5" fill="#ccc"/>
      <ellipse cx="16" cy="14" rx="5" ry="3" fill="#fff" opacity="0.5"/>
    </svg>
  );
}

function ResultScreen({ type, pseudo, onClose }: { type: "victory" | "defeat" | "fled"; pseudo: string; onClose: () => void }) {
  const messages = {
    victory: { title: "VICTOIRE !", text: `Bravo ${pseudo} ! Tu as capturé RAIKOU !`, color: "#fbbf24" },
    defeat: { title: "DÉFAITE…", text: "Toute ton équipe est K.O. ou plus de Pokéballs.", color: "#e03030" },
    fled: { title: "RAIKOU S'ENFUIT", text: "Tu as mis K.O. RAIKOU. Il s'est enfui dans la nuit…", color: "#94a3b8" },
  };
  const m = messages[type];

  // Auto-close after 6 seconds so the player always sees the result clearly
  // but isn't blocked if they don't click.
  useEffect(() => {
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#0a0518] p-6" style={{ fontFamily: "'Courier New', monospace" }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm text-center" style={{ boxShadow: "8px 8px 0 #000" }}>
        <h1 className="text-2xl font-bold mb-4" style={{ color: m.color }}>{m.title}</h1>
        <p className="text-sm text-black mb-6">{m.text}</p>
        <button onClick={onClose} className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-gray-800">FERMER</button>
      </motion.div>
    </div>
  );
}