"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchPokemonData, type PokemonData } from "../lib/pokeApi";
import {
  calculateDamage, calculateMaxHP, getEffectiveness, pickMovesForPokemon,
  canMoveWithParalysis, burnDamage, poisonDamage,
  TYPE_COLORS, BEAST_CONFIGS,
  type Move, type PokemonType, type StatusState, type BeastConfig,
} from "../lib/battleSystem";
import { updateLiveBattle, submitBeastsResult } from "../hooks/useEvent";
import type { Player, PlayerPokemon } from "../lib/playerRoster";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Phase = "intro" | "battle" | "switch_pokemon" | "beast_defeated" | "victory" | "defeat";

interface TeamMember {
  pokemon: PlayerPokemon;
  data: PokemonData;
  currentHP: number;
  maxHP: number;
  fainted: boolean;
  moves: Move[];
  status: StatusState;
}

interface BState {
  beastHP: number;
  beastMaxHP: number;
  beastStatus: StatusState;
  log: string[];
  busy: boolean;
}

export function BeastsBattle({
  pseudo, player, onComplete,
}: {
  pseudo: string;
  player: Player;
  onComplete: (passed: boolean, defeated: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const teamRef = useRef<TeamMember[]>([]);
  useEffect(() => { teamRef.current = team; }, [team]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [beastIdx, setBeastIdx] = useState(0);
  const beast = BEAST_CONFIGS[beastIdx];
  const [beastsDefeated, setBeastsDefeated] = useState(0);

  const [battle, setBattle] = useState<BState>({
    beastHP: beast.maxHP, beastMaxHP: beast.maxHP,
    beastStatus: { status: null }, log: [], busy: false,
  });
  const [menuMode, setMenuMode] = useState<"main" | "moves">("main");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Music
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const shouldPlay = (phase === "battle" || phase === "switch_pokemon" || phase === "beast_defeated") && musicEnabled;
    if (shouldPlay) { audio.volume = 0.25; audio.loop = true; audio.play().catch(() => {}); }
    else { audio.pause(); }
  }, [phase, musicEnabled]);

  // Load team
  useEffect(() => {
    (async () => {
      const teamData: TeamMember[] = [];
      for (const p of player.team) {
        const data = await fetchPokemonData(p.name);
        if (data) {
          const maxHP = calculateMaxHP(p.level, data.baseHP);
          teamData.push({
            pokemon: p, data, currentHP: maxHP, maxHP, fainted: false,
            moves: pickMovesForPokemon(data.types), status: { status: null },
          });
        }
      }
      setTeam(teamData);
    })();
  }, [player]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Start battle against current beast
  const startBeastFight = useCallback((teamIdx: number) => {
    const b = BEAST_CONFIGS[beastIdx];
    setActiveIdx(teamIdx);
    setBattle({
      beastHP: b.maxHP, beastMaxHP: b.maxHP,
      beastStatus: { status: null },
      log: [`${b.displayName} sauvage apparaît !`, `Allez ${team[teamIdx].pokemon.name.toUpperCase()} !`],
      busy: false,
    });
    setPhase("battle");
    setMenuMode("main");
  }, [team, beastIdx]);

  // After intro, go to first fight
  useEffect(() => {
    if (phase === "intro" && team.length > 0) {
      const timer = setTimeout(() => {
        startBeastFight(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, team.length, startBeastFight]);

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

  // Broadcast live
  const broadcastLive = useCallback((extra?: Partial<{ lastAction: string; status: string }>) => {
    const active = teamRef.current[activeIdx];
    const b = BEAST_CONFIGS[beastIdx];
    updateLiveBattle({
      pseudo, pokemon: b.name,
      currentPokemon: active?.pokemon.name || null,
      currentPokemonHP: active?.currentHP, currentPokemonMaxHP: active?.maxHP,
      raikouHP: battle.beastHP, raikouMaxHP: battle.beastMaxHP,
      battlePhase: "beasts", currentBeast: b.name,
      beastsDefeated, lastAction: extra?.lastAction || "",
      log: battle.log.slice(-4),
      status: (extra?.status as any) || "in_battle",
    });
  }, [pseudo, activeIdx, beastIdx, battle, beastsDefeated]);

  /* ─── Beast AI ─── */
  const pickBeastMove = useCallback((opponent: TeamMember, b: BeastConfig): Move => {
    const damagingMoves = b.moves.filter((m) => {
      if (m.power === 0) {
        return opponent.status.status === null;
      }
      return true;
    });
    if (damagingMoves.length === 0) return b.moves[Math.floor(Math.random() * b.moves.length)];

    // Pick move weighted by effectiveness
    const scored = damagingMoves.map((m) => ({
      move: m,
      score: m.power * getEffectiveness(m.type, opponent.data.types) * (b.types.includes(m.type) ? 1.5 : 1),
    }));
    scored.sort((a, b) => b.score - a.score);
    // 70% chance best move, 30% random
    return Math.random() < 0.7 ? scored[0].move : damagingMoves[Math.floor(Math.random() * damagingMoves.length)];
  }, []);

  /* ─── Beast attacks ─── */
  const beastAttack = useCallback(async (active: TeamMember, chainNext: boolean = false): Promise<boolean> => {
    const b = BEAST_CONFIGS[beastIdx];

    if (battle.beastStatus.status === "paralysis" && !canMoveWithParalysis()) {
      setBattle((s) => ({ ...s, log: [`${b.displayName} est paralysé !`] }));
      await sleep(1200);
      if (!chainNext) setBattle((s) => ({ ...s, busy: false, log: [...s.log, "Que voulez-vous faire ?"] }));
      return false;
    }

    const move = pickBeastMove(active, b);
    const eff = getEffectiveness(move.type, active.data.types);
    const isStab = b.types.includes(move.type);
    const damage = calculateDamage(b.level, move.power, eff, isStab);

    setBattle((s) => ({ ...s, log: [`${b.displayName} utilise ${move.name} !`] }));
    await sleep(900);

    if (move.power === 0) {
      if (active.status.status !== null) {
        setBattle((s) => ({ ...s, log: [...s.log, "Mais ça échoue !"] }));
      } else {
        setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, status: { status: move.effect! } } : m));
        setBattle((s) => ({ ...s, log: [...s.log, `${active.pokemon.name.toUpperCase()} est paralysé !`] }));
      }
      await sleep(1100);
      if (!chainNext) setBattle((s) => ({ ...s, busy: false, log: [...s.log, "Que voulez-vous faire ?"] }));
      return false;
    }

    if (eff === 0) {
      setBattle((s) => ({ ...s, log: [...s.log, `Ça n'affecte pas ${active.pokemon.name.toUpperCase()} !`] }));
      await sleep(1100);
      if (!chainNext) setBattle((s) => ({ ...s, busy: false, log: [...s.log, "Que voulez-vous faire ?"] }));
      return false;
    }

    let effMsg = "";
    if (eff > 1) effMsg = " C'est super efficace !";
    else if (eff < 1) effMsg = " Pas très efficace…";

    const newHP = Math.max(0, active.currentHP - damage);
    setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: newHP, fainted: newHP <= 0 } : m));
    setBattle((s) => ({ ...s, log: [...s.log, `${damage} dégâts !${effMsg}`] }));
    await sleep(1100);

    // Secondary effect
    if (move.effect && move.effectChance && Math.random() < move.effectChance && active.status.status === null) {
      const canApply = !(move.effect === "burn" && active.data.types.includes("Feu")) && !(move.effect === "paralysis" && active.data.types.includes("Électrik"));
      if (canApply) {
        setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, status: { status: move.effect! } } : m));
        setBattle((s) => ({ ...s, log: [...s.log, `${active.pokemon.name.toUpperCase()} est ${move.effect === "burn" ? "brûlé" : "paralysé"} !`] }));
        await sleep(1200);
      }
    }

    if (newHP <= 0) {
      setBattle((s) => ({ ...s, log: [...s.log, `${active.pokemon.name.toUpperCase()} est K.O. !`] }));
      await sleep(1500);
      const alive = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted);
      if (alive.length === 0) {
        setBattle((s) => ({ ...s, log: [...s.log, "Toute votre équipe est K.O. !"], busy: false }));
        submitBeastsResult(pseudo, beastsDefeated, false);
        updateLiveBattle({ pseudo, pokemon: b.name, status: "defeat", battlePhase: "beasts", lastAction: "Équipe K.O." });
        await sleep(2000);
        setPhase("defeat");
        return true;
      }
      setBattle((s) => ({ ...s, busy: false }));
      setPhase("switch_pokemon");
      return true;
    }

    if (!chainNext) setBattle((s) => ({ ...s, busy: false, log: [...s.log, "Que voulez-vous faire ?"] }));
    return false;
  }, [battle.beastStatus, activeIdx, beastIdx, pseudo, beastsDefeated, pickBeastMove]);

  /* ─── Player attack ─── */
  const playerAttack = useCallback(async (moveIndex: number) => {
    const active = teamRef.current[activeIdx];
    const b = BEAST_CONFIGS[beastIdx];
    if (!active || battle.busy) return;
    setBattle((s) => ({ ...s, busy: true }));
    setMenuMode("main");

    // Beast attacks first
    const playerKO = await beastAttack(active, true);
    if (playerKO) return;

    const after = teamRef.current[activeIdx];
    if (!after || after.fainted) return;

    // Player paralysis check
    if (after.status.status === "paralysis" && !canMoveWithParalysis()) {
      setBattle((s) => ({ ...s, log: [...s.log, `${after.pokemon.name.toUpperCase()} est paralysé !`] }));
      await sleep(1400);
      setBattle((s) => ({ ...s, busy: false, log: [...s.log, "Que voulez-vous faire ?"] }));
      return;
    }

    const move = after.moves[moveIndex];
    const isStab = after.data.types.includes(move.type);
    const eff = getEffectiveness(move.type, b.types);
    const damage = calculateDamage(after.pokemon.level, move.power, eff, isStab);

    setBattle((s) => ({ ...s, log: [...s.log, `${after.pokemon.name.toUpperCase()} utilise ${move.name} !`] }));
    await sleep(900);

    if (eff === 0) {
      setBattle((s) => ({ ...s, log: [...s.log, `Ça n'affecte pas ${b.displayName} !`], busy: false }));
      await sleep(1100);
      setBattle((s) => ({ ...s, log: [...s.log, "Que voulez-vous faire ?"] }));
      return;
    }

    let effMsg = eff > 1 ? " C'est super efficace !" : eff < 1 ? " Pas très efficace…" : "";
    const newBeastHP = Math.max(0, battle.beastHP - damage);
    setBattle((s) => ({ ...s, beastHP: newBeastHP, log: [...s.log, `${damage} dégâts !${effMsg}`] }));
    broadcastLive({ lastAction: `${after.pokemon.name} → ${move.name} (${damage})` });
    await sleep(1100);

    // Status on beast
    if (move.effect && move.effectChance && Math.random() < move.effectChance && battle.beastStatus.status === null) {
      setBattle((s) => ({ ...s, beastStatus: { status: move.effect! }, log: [...s.log, `${b.displayName} est ${move.effect === "burn" ? "brûlé" : "paralysé"} !`] }));
      await sleep(1200);
    }

    // Beast defeated!
    if (newBeastHP <= 0) {
      const newDefeated = beastsDefeated + 1;
      setBeastsDefeated(newDefeated);
      setBattle((s) => ({ ...s, log: [...s.log, `${b.displayName} est vaincu !`], busy: false }));
      await sleep(2000);

      if (newDefeated >= BEAST_CONFIGS.length) {
        // All beasts defeated!
        submitBeastsResult(pseudo, newDefeated, true);
        updateLiveBattle({ pseudo, pokemon: "ho-oh", status: "victory", battlePhase: "beasts", lastAction: "Trio légendaire vaincu !" });
        setPhase("victory");
      } else {
        // Next beast
        setBeastIdx(beastIdx + 1);
        setPhase("beast_defeated");
      }
      return;
    }

    // End-of-turn status damage
    const cur = teamRef.current[activeIdx];
    if (cur && !cur.fainted && cur.status.status === "burn") {
      const dmg = burnDamage(cur.maxHP);
      const hp = Math.max(0, cur.currentHP - dmg);
      setTeam((prev) => prev.map((m, i) => i === activeIdx ? { ...m, currentHP: hp, fainted: hp <= 0 } : m));
      setBattle((s) => ({ ...s, log: [...s.log, `${cur.pokemon.name.toUpperCase()} souffre de sa brûlure ! -${dmg} PV`] }));
      await sleep(900);
      if (hp <= 0) {
        const alive = teamRef.current.filter((m, i) => i !== activeIdx && !m.fainted);
        if (alive.length === 0) {
          submitBeastsResult(pseudo, beastsDefeated, false);
          await sleep(1500);
          setPhase("defeat");
          return;
        }
        setBattle((s) => ({ ...s, busy: false }));
        setPhase("switch_pokemon");
        return;
      }
    }

    setBattle((s) => ({ ...s, busy: false, log: [...s.log, "Que voulez-vous faire ?"] }));
  }, [activeIdx, battle, beastIdx, beastsDefeated, beastAttack, pseudo, broadcastLive]);

  /* ─── Render ─── */
  const audioEl = <audio ref={audioRef} src={`${BASE_PATH}/audio/beasts-theme.mp3`} preload="auto" />;

  // Intro
  if (phase === "intro") {
    return (
      <>{audioEl}
      <div className="h-dvh w-full flex items-center justify-center"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #1a0a2e, #0a0518)", fontFamily: "'Courier New', monospace" }}
      >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <p className="text-white/30 text-xs tracking-[0.2em] uppercase mb-4">Épreuve 2</p>
          <h1 className="text-3xl font-black text-transparent bg-clip-text"
            style={{ backgroundImage: "linear-gradient(135deg, #fbbf24, #ef4444, #38bdf8)" }}
          >Le Trio Légendaire</h1>
          <p className="text-white/30 text-sm mt-3">Raikou · Entei · Suicune</p>
          <div className="flex justify-center gap-4 mt-6">
            {BEAST_CONFIGS.map((b, i) => (
              <motion.img key={i} src={b.sprite} alt={b.name}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.3 }}
                style={{ imageRendering: "pixelated", width: "60px", filter: `drop-shadow(0 0 10px ${b.glowColor})` }} />
            ))}
          </div>
          <p className="text-white/20 text-xs mt-4 animate-pulse">Chargement…</p>
        </motion.div>
      </div></>
    );
  }

  // Beast defeated transition
  if (phase === "beast_defeated") {
    const nextBeast = BEAST_CONFIGS[beastIdx];
    return (
      <>{audioEl}
      <div className="h-dvh w-full flex items-center justify-center"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #1a0a2e, #0a0518)", fontFamily: "'Courier New', monospace" }}
      >
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="text-3xl mb-4">⚔️</div>
          <h2 className="text-xl font-bold text-white mb-2">Bête {beastsDefeated}/3 vaincue !</h2>
          <p className="text-white/40 text-sm mb-6">Prochain adversaire : <strong style={{ color: nextBeast.color }}>{nextBeast.displayName}</strong></p>
          <motion.img src={nextBeast.sprite} alt={nextBeast.name}
            animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}
            style={{ imageRendering: "pixelated", width: "100px", margin: "0 auto", filter: `drop-shadow(0 0 15px ${nextBeast.glowColor})` }}
          />
          <p className="text-white/20 text-xs mt-4">Votre équipe continue sans heal…</p>
          <button onClick={() => startBeastFight(activeIdx)}
            className="mt-6 bg-white/10 border border-white/20 px-6 py-2 text-sm font-bold text-white hover:bg-white/20 transition-colors"
          >COMBATTRE →</button>
        </motion.div>
      </div></>
    );
  }

  // Switch pokemon
  if (phase === "switch_pokemon") {
    return (
      <>{audioEl}
      <div className="h-dvh w-full p-4 overflow-auto"
        style={{ fontFamily: "'Courier New', monospace", background: beast.name === "raikou" ? "#0a0518" : beast.name === "entei" ? "#1a0808" : "#0a0a1a" }}
      >
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-4" style={{ boxShadow: "6px 6px 0 #000" }}>
            <h1 className="text-lg font-bold text-black">Pokémon K.O. — Choisis le suivant</h1>
            <p className="text-xs text-gray-600">VS {beast.displayName} · {beastsDefeated}/3 bêtes vaincues</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {team.map((m, i) => (
              <button key={i} disabled={m.fainted}
                onClick={() => !m.fainted && switchPokemon(i)}
                className="bg-[#f8f0e0] border-4 border-black p-3 text-left disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ffe080] transition-colors"
                style={{ boxShadow: m.fainted ? "none" : "4px 4px 0 #000", filter: m.fainted ? "grayscale(1)" : undefined }}
              >
                <div className="flex items-center justify-center h-16 mb-1">
                  {m.data.spriteAnimated ? <img src={m.data.spriteAnimated} alt={m.pokemon.name} style={{ imageRendering: "pixelated", height: "55px" }} />
                  : m.data.sprite ? <img src={m.data.sprite} alt={m.pokemon.name} style={{ height: "55px" }} /> : null}
                </div>
                <div className="text-[11px] font-bold text-black">{m.pokemon.name.toUpperCase()}</div>
                <div className="text-[9px] text-black font-bold">{m.fainted ? "K.O." : `${m.currentHP}/${m.maxHP}`}</div>
              </button>
            ))}
          </div>
        </div>
      </div></>
    );
  }

  // Victory
  if (phase === "victory") {
    return (
      <>{audioEl}
      <div className="h-dvh w-full flex items-center justify-center p-6"
        style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 30%, #1a0a2e, #0a0518)" }}
      >
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm text-center" style={{ boxShadow: "8px 8px 0 #000" }}
        >
          <div className="text-4xl mb-3">🏆</div>
          <h1 className="text-2xl font-bold text-amber-600 mb-3">TRIO VAINCU !</h1>
          <p className="text-sm text-gray-700 mb-4">Bravo {pseudo} ! Tu as vaincu les 3 bêtes légendaires !</p>
          <p className="text-xs text-gray-500 mb-6">Tu es qualifié pour affronter le boss final : HO-OH !</p>
          <button onClick={() => onComplete(true, 3)} className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-gray-800">CONTINUER →</button>
        </motion.div>
      </div></>
    );
  }

  // Defeat
  if (phase === "defeat") {
    return (
      <>{audioEl}
      <div className="h-dvh w-full flex items-center justify-center p-6"
        style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 30%, #1a0a2e, #0a0518)" }}
      >
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm text-center" style={{ boxShadow: "8px 8px 0 #000" }}
        >
          <div className="text-4xl mb-3">💀</div>
          <h1 className="text-2xl font-bold text-red-600 mb-3">DÉFAITE…</h1>
          <p className="text-sm text-gray-700 mb-4">Ton équipe a été vaincue. {beastsDefeated}/3 bêtes défaites.</p>
          <button onClick={() => onComplete(false, beastsDefeated)} className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-gray-800">FERMER</button>
        </motion.div>
      </div></>
    );
  }

  /* ─── BATTLE SCREEN ─── */
  const active = team[activeIdx];
  if (!active) return null;
  const moves = active.moves;
  const beastHpPct = (battle.beastHP / battle.beastMaxHP) * 100;
  const playerHpPct = (active.currentHP / active.maxHP) * 100;
  const hpBarColor = (pct: number) => pct > 50 ? "#22c55e" : pct > 20 ? "#f59e0b" : "#ef4444";

  const bgMap: Record<string, string> = {
    raikou: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 40%, #4a2d6e 100%)",
    entei: "linear-gradient(180deg, #2d0800 0%, #4a1200 40%, #5a2010 100%)",
    suicune: "linear-gradient(180deg, #0a1a2e 0%, #1b2d4e 40%, #2d4a6e 100%)",
  };

  return (
    <>{audioEl}
    <div className="h-dvh w-full flex flex-col" style={{ fontFamily: "'Courier New', monospace", background: "#0a0518" }}>
      {/* Arena */}
      <div className="relative flex-1 overflow-hidden" style={{ background: bgMap[beast.name] || bgMap.raikou, minHeight: "55%" }}>
        {/* Beast progress dots */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {BEAST_CONFIGS.map((b, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full border-2" style={{
                borderColor: b.color,
                background: i < beastsDefeated ? b.color : i === beastIdx ? b.color + "60" : "transparent",
              }} />
              {i < 2 && <div className="w-3 h-px" style={{ background: i < beastsDefeated ? b.color : "rgba(255,255,255,0.1)" }} />}
            </div>
          ))}
        </div>

        {/* Beast info */}
        <div className="absolute top-10 left-3 sm:left-4 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 z-20 max-w-[55%]"
          style={{ boxShadow: "4px 4px 0 #000" }}
        >
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[13px] font-bold" style={{ color: beast.color }}>{beast.displayName}</span>
            <span className="text-[10px] text-gray-700">Niv. {beast.level}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="flex-1 h-2 bg-black border border-black" style={{ padding: "1px", minWidth: "90px" }}>
              <div style={{
                width: `${beastHpPct}%`, height: "100%",
                background: hpBarColor(beastHpPct), transition: "width 0.5s",
              }} />
            </div>
          </div>
        </div>

        {/* Beast sprite */}
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: "200px", height: "200px", borderRadius: "50%", background: `radial-gradient(circle, ${beast.glowColor}, transparent 70%)`, filter: "blur(20px)" }} />
          <img src={beast.sprite} alt={beast.name}
            style={{ imageRendering: "pixelated", width: "min(160px, 33vw)", position: "relative", filter: `drop-shadow(0 0 12px ${beast.glowColor})` }} />
        </motion.div>

        {/* Player sprite */}
        <motion.div className="absolute z-10" style={{ bottom: "12%", left: "8%" }}
          animate={{ y: [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity }}
        >
          {active.data.spriteAnimated ? (
            <img src={active.data.spriteAnimated} alt={active.pokemon.name}
              style={{ imageRendering: "pixelated", width: "min(110px, 23vw)", transform: "scaleX(-1)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }} />
          ) : active.data.sprite ? (
            <img src={active.data.sprite} alt={active.pokemon.name}
              style={{ width: "min(90px, 20vw)", transform: "scaleX(-1)" }} />
          ) : null}
        </motion.div>

        {/* Player info box */}
        <div className="absolute bottom-3 right-3 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 z-20 max-w-[50%]"
          style={{ boxShadow: "4px 4px 0 #000" }}
        >
          <span className="text-[12px] font-bold text-black">{active.pokemon.name.toUpperCase()}</span>
          <span className="text-[10px] text-gray-600 ml-2">Niv. {active.pokemon.level}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="flex-1 h-2 bg-black border border-black" style={{ padding: "1px" }}>
              <div style={{ width: `${playerHpPct}%`, height: "100%", background: hpBarColor(playerHpPct), transition: "width 0.5s" }} />
            </div>
          </div>
          <div className="text-[9px] text-black font-bold mt-0.5">{active.currentHP}/{active.maxHP}</div>
        </div>

        {/* Music toggle */}
        <button onClick={() => setMusicEnabled((m) => !m)}
          className="absolute top-10 right-3 z-20 border-[3px] border-black bg-[#f8f0e0] px-2 py-1 text-sm font-bold"
          style={{ boxShadow: "3px 3px 0 #000" }}
        >{musicEnabled ? "🔊" : "🔇"}</button>
      </div>

      {/* Commands */}
      <div className="bg-[#f8f0e0] border-t-4 border-black" style={{ minHeight: "200px", padding: "10px 12px 12px" }}>
        <div className="bg-white border-[3px] border-black p-3 mb-2.5 relative" style={{ boxShadow: "4px 4px 0 #000", minHeight: "50px" }}>
          <div className="absolute top-1 left-1 right-1 bottom-1 border border-gray-300 pointer-events-none" />
          {battle.log.slice(-2).map((line, i) => (
            <p key={i} className="text-[13px] text-black font-bold" style={{ lineHeight: "1.5" }}>{line}</p>
          ))}
        </div>

        {menuMode === "main" ? (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={battle.busy} onClick={() => setMenuMode("moves")}
              className="border-[3px] border-black p-3 text-sm font-bold disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ boxShadow: "4px 4px 0 #000", background: TYPE_COLORS[active.data.types[0] || "Normal"], color: "#000" }}
            >⚔️ ATTAQUE</button>
            <button disabled className="border-[3px] border-black p-3 text-sm font-bold opacity-30"
              style={{ boxShadow: "4px 4px 0 #000", background: "#e5e5e5", color: "#666" }}
            >🔒 CAPTURE</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {moves.map((m, i) => (
              <button key={i} disabled={battle.busy} onClick={() => playerAttack(i)}
                className="border-[3px] border-black p-2.5 text-left disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                style={{ boxShadow: "4px 4px 0 #000", background: TYPE_COLORS[m.type], color: "#000" }}
              >
                <div className="text-[12px] font-bold" style={{ textShadow: "1px 1px 0 rgba(255,255,255,0.5)" }}>{m.name.toUpperCase()}</div>
                <div className="text-[10px] text-black/70 font-bold">PUI: {m.power} · {m.type.toUpperCase()}</div>
              </button>
            ))}
            <button onClick={() => setMenuMode("main")} className="col-span-2 text-[11px] text-black font-bold underline mt-1">← Retour</button>
          </div>
        )}
      </div>
    </div></>
  );
}
