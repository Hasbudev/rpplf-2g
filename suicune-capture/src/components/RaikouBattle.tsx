"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchPlayers, type Player, type PlayerPokemon } from "../lib/playerRoster";
import { fetchPokemonData, type PokemonData } from "../lib/pokeApi";
import {
  calculateDamage,
  calculateMaxHP,
  calculateCaptureRate,
  effectivenessVsElectric,
  electricVsType,
  TYPE_MOVES,
  RAIKOU_MOVES,
  TYPE_COLORS,
  type PokemonType,
} from "../lib/battleSystem";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const RAIKOU_LEVEL = 40;
const RAIKOU_BASE_HP = 90;
const MAX_POKEBALLS = 3;

type Phase = "loading" | "name_input" | "not_found" | "team_select" | "battle" | "victory" | "defeat" | "fled";

interface BattleState {
  raikouHP: number;
  raikouMaxHP: number;
  playerHP: number;
  playerMaxHP: number;
  pokeballsLeft: number;
  log: string[];
  busy: boolean;
  raikouFled: boolean;
}

export function RaikouBattle({ pseudo, onComplete }: { pseudo: string; onComplete: (won: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [player, setPlayer] = useState<Player | null>(null);
  const [selectedPokemon, setSelectedPokemon] = useState<PlayerPokemon | null>(null);
  const [pokemonData, setPokemonData] = useState<PokemonData | null>(null);
  const [battle, setBattle] = useState<BattleState>({
    raikouHP: 0, raikouMaxHP: 0, playerHP: 0, playerMaxHP: 0,
    pokeballsLeft: MAX_POKEBALLS, log: [], busy: false, raikouFled: false,
  });
  const [menuMode, setMenuMode] = useState<"main" | "moves">("main");

  // Load player from sheet
  useEffect(() => {
    (async () => {
      const players = await fetchPlayers();
      const found = players.find((p) => p.name.toLowerCase() === pseudo.toLowerCase());
      if (!found) {
        setPhase("not_found");
      } else {
        setPlayer(found);
        setPhase("team_select");
      }
    })();
  }, [pseudo]);

  // When pokemon selected, fetch its data and start battle
  const startBattle = useCallback(async (pokemon: PlayerPokemon) => {
    setSelectedPokemon(pokemon);
    setPhase("loading");
    const data = await fetchPokemonData(pokemon.name);
    if (!data) {
      alert(`Impossible de trouver les données de ${pokemon.name}`);
      setPhase("team_select");
      return;
    }
    setPokemonData(data);

    const playerMaxHP = calculateMaxHP(pokemon.level, data.baseHP);
    const raikouMaxHP = calculateMaxHP(RAIKOU_LEVEL, RAIKOU_BASE_HP);

    setBattle({
      raikouHP: raikouMaxHP,
      raikouMaxHP,
      playerHP: playerMaxHP,
      playerMaxHP,
      pokeballsLeft: MAX_POKEBALLS,
      log: [`Un RAIKOU sauvage apparaît !`, `Allez ${pokemon.name.toUpperCase()} !`],
      busy: false,
      raikouFled: false,
    });
    setPhase("battle");
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Player attacks
  const playerAttack = useCallback(async (moveIndex: number) => {
    if (!selectedPokemon || !pokemonData || battle.busy) return;
    setBattle((b) => ({ ...b, busy: true }));
    setMenuMode("main");

    const playerType = pokemonData.types[0] || "Normal";
    const moves = TYPE_MOVES[playerType];
    const move = moves[moveIndex];
    const isStab = pokemonData.types.includes(playerType);
    const eff = effectivenessVsElectric(playerType);

    const damage = calculateDamage(selectedPokemon.level, move.power, eff, isStab);

    setBattle((b) => ({
      ...b,
      log: [`${selectedPokemon.name.toUpperCase()} utilise ${move.name} !`],
    }));
    await sleep(900);

    let effMsg = "";
    if (eff > 1) effMsg = " C'est super efficace !";
    else if (eff < 1 && eff > 0) effMsg = " Ce n'est pas très efficace…";
    else if (eff === 0) effMsg = " Ça n'affecte pas RAIKOU…";

    const newRaikouHP = Math.max(0, battle.raikouHP - damage);
    setBattle((b) => ({
      ...b,
      raikouHP: newRaikouHP,
      log: [...b.log, `${damage} dégâts !${effMsg}`],
    }));
    await sleep(1100);

    if (newRaikouHP <= 0) {
      setBattle((b) => ({
        ...b,
        log: [...b.log, `RAIKOU est K.O. ! Il s'enfuit dans la forêt…`],
        busy: false,
        raikouFled: true,
      }));
      await sleep(2000);
      setPhase("fled");
      onComplete(false);
      return;
    }

    // Raikou counter-attacks
    const raikouMove = RAIKOU_MOVES[Math.floor(Math.random() * RAIKOU_MOVES.length)];
    const raikouEff = electricVsType(playerType);
    const raikouDamage = calculateDamage(RAIKOU_LEVEL, raikouMove.power, raikouEff, true);

    setBattle((b) => ({
      ...b,
      log: [`RAIKOU utilise ${raikouMove.name} !`],
    }));
    await sleep(900);

    let raikouEffMsg = "";
    if (raikouEff > 1) raikouEffMsg = " C'est super efficace !";
    else if (raikouEff < 1 && raikouEff > 0) raikouEffMsg = " Ce n'est pas très efficace…";
    else if (raikouEff === 0) raikouEffMsg = " Ça n'affecte pas !";

    const newPlayerHP = Math.max(0, battle.playerHP - raikouDamage);
    setBattle((b) => ({
      ...b,
      playerHP: newPlayerHP,
      log: [...b.log, `${raikouDamage} dégâts !${raikouEffMsg}`],
    }));
    await sleep(1100);

    if (newPlayerHP <= 0) {
      setBattle((b) => ({
        ...b,
        log: [...b.log, `${selectedPokemon.name.toUpperCase()} est K.O. !`],
        busy: false,
      }));
      await sleep(2000);
      setPhase("defeat");
      onComplete(false);
      return;
    }

    setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
  }, [battle, pokemonData, selectedPokemon, onComplete]);

  // Try to capture
  const throwPokeball = useCallback(async () => {
    if (battle.busy || battle.pokeballsLeft <= 0) return;
    setBattle((b) => ({ ...b, busy: true }));

    const hpPercent = battle.raikouHP / battle.raikouMaxHP;
    const captureRate = calculateCaptureRate(hpPercent);
    const success = Math.random() < captureRate;

    setBattle((b) => ({
      ...b,
      pokeballsLeft: b.pokeballsLeft - 1,
      log: ["Vous lancez une POKÉBALL !"],
    }));
    await sleep(1000);

    setBattle((b) => ({ ...b, log: [...b.log, "*shake*"] }));
    await sleep(600);
    setBattle((b) => ({ ...b, log: [...b.log, "*shake*"] }));
    await sleep(600);
    setBattle((b) => ({ ...b, log: [...b.log, "*shake*"] }));
    await sleep(600);

    if (success) {
      setBattle((b) => ({ ...b, log: [...b.log, "RAIKOU a été capturé !"] }));
      await sleep(2000);
      setPhase("victory");
      onComplete(true);
      return;
    }

    setBattle((b) => ({ ...b, log: [...b.log, "Oh non ! RAIKOU s'est échappé !"] }));
    await sleep(1500);

    if (battle.pokeballsLeft - 1 <= 0) {
      setBattle((b) => ({ ...b, log: [...b.log, "Plus de POKÉBALLS !"], busy: false }));
      await sleep(2000);
      setPhase("defeat");
      onComplete(false);
      return;
    }

    // Raikou counter-attacks after failed catch
    if (selectedPokemon && pokemonData) {
      const raikouMove = RAIKOU_MOVES[Math.floor(Math.random() * RAIKOU_MOVES.length)];
      const raikouEff = electricVsType(pokemonData.types[0] || "Normal");
      const raikouDamage = calculateDamage(RAIKOU_LEVEL, raikouMove.power, raikouEff, true);

      setBattle((b) => ({ ...b, log: [`RAIKOU utilise ${raikouMove.name} !`] }));
      await sleep(900);

      const newPlayerHP = Math.max(0, battle.playerHP - raikouDamage);
      setBattle((b) => ({
        ...b,
        playerHP: newPlayerHP,
        log: [...b.log, `${raikouDamage} dégâts !`],
      }));
      await sleep(1100);

      if (newPlayerHP <= 0) {
        setBattle((b) => ({ ...b, log: [...b.log, `${selectedPokemon.name.toUpperCase()} est K.O. !`], busy: false }));
        await sleep(2000);
        setPhase("defeat");
        onComplete(false);
        return;
      }
    }

    setBattle((b) => ({ ...b, busy: false, log: [...b.log, "Que voulez-vous faire ?"] }));
  }, [battle, selectedPokemon, pokemonData, onComplete]);

  /* ─── RENDER ─── */

  if (phase === "loading") {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-[#0a0520]">
        <div style={{ fontFamily: "'Courier New', monospace", color: "#f8f0e0" }}>
          <p>Chargement…</p>
        </div>
      </div>
    );
  }

  if (phase === "not_found") {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-[#0a0520] p-6">
        <div style={{ fontFamily: "'Courier New', monospace" }} className="max-w-sm text-center">
          <div className="bg-[#f8f0e0] border-4 border-black p-6" style={{ boxShadow: "6px 6px 0 #000" }}>
            <h2 className="text-xl font-bold text-black mb-3">DRESSEUR INTROUVABLE</h2>
            <p className="text-sm text-gray-700 mb-4">
              Le pseudo <strong className="text-black">{pseudo}</strong> n'est pas dans la liste de la saison 2G.
            </p>
            <p className="text-xs text-gray-500">Vérifie l'orthographe et réessaie.</p>
            <button onClick={() => onComplete(false)} className="mt-4 bg-black text-white px-4 py-2 text-sm font-bold">
              RETOUR
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "team_select" && player) {
    return <TeamSelect player={player} onSelect={startBattle} />;
  }

  if (phase === "victory") {
    return <ResultScreen type="victory" pseudo={pseudo} onClose={() => onComplete(true)} />;
  }
  if (phase === "defeat") {
    return <ResultScreen type="defeat" pseudo={pseudo} onClose={() => onComplete(false)} />;
  }
  if (phase === "fled") {
    return <ResultScreen type="fled" pseudo={pseudo} onClose={() => onComplete(false)} />;
  }

  // Battle phase
  return (
    <BattleScreen
      battle={battle}
      pokemonData={pokemonData}
      selectedPokemon={selectedPokemon}
      menuMode={menuMode}
      setMenuMode={setMenuMode}
      onAttack={playerAttack}
      onCatch={throwPokeball}
    />
  );
}

/* ═══════════════════════════════════════════════
   TEAM SELECT
   ═══════════════════════════════════════════════ */

function TeamSelect({ player, onSelect }: { player: Player; onSelect: (p: PlayerPokemon) => void }) {
  const [pokemonDatas, setPokemonDatas] = useState<Map<string, PokemonData>>(new Map());

  useEffect(() => {
    (async () => {
      const map = new Map<string, PokemonData>();
      await Promise.all(
        player.team.map(async (p) => {
          const data = await fetchPokemonData(p.name);
          if (data) map.set(p.name, data);
        })
      );
      setPokemonDatas(map);
    })();
  }, [player]);

  return (
    <div className="h-dvh w-full bg-[#0a0520] p-4 sm:p-8 overflow-auto" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#f8f0e0] border-4 border-black p-4 mb-6" style={{ boxShadow: "6px 6px 0 #000" }}>
          <h1 className="text-xl font-bold text-black mb-1">DRESSEUR : {player.name.toUpperCase()}</h1>
          <p className="text-xs text-gray-700">Choisis le Pokémon qui affrontera RAIKOU !</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {player.team.map((pokemon, i) => {
            const data = pokemonDatas.get(pokemon.name);
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelect(pokemon)}
                className="bg-[#f8f0e0] border-4 border-black p-3 hover:bg-[#ffe080] transition-colors text-left cursor-pointer"
                style={{ boxShadow: "4px 4px 0 #000" }}
              >
                <div className="flex items-center justify-center h-20 mb-2">
                  {data?.spriteAnimated ? (
                    <img src={data.spriteAnimated} alt={pokemon.name} style={{ imageRendering: "pixelated", height: "70px" }} />
                  ) : data?.sprite ? (
                    <img src={data.sprite} alt={pokemon.name} style={{ height: "70px" }} />
                  ) : (
                    <div className="text-xs text-gray-400">…</div>
                  )}
                </div>
                <div className="text-sm font-bold text-black">{pokemon.name.toUpperCase()}</div>
                <div className="text-xs text-gray-700">Niv. {pokemon.level}</div>
                {data && (
                  <div className="flex gap-1 mt-1">
                    {data.types.map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded text-white font-bold" style={{ background: TYPE_COLORS[t] }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   BATTLE SCREEN
   ═══════════════════════════════════════════════ */

function BattleScreen({ battle, pokemonData, selectedPokemon, menuMode, setMenuMode, onAttack, onCatch }: {
  battle: BattleState; pokemonData: PokemonData | null; selectedPokemon: PlayerPokemon | null;
  menuMode: "main" | "moves"; setMenuMode: (m: "main" | "moves") => void;
  onAttack: (i: number) => void; onCatch: () => void;
}) {
  const playerType = pokemonData?.types[0] || "Normal";
  const moves = TYPE_MOVES[playerType];
  const raikouHpPercent = (battle.raikouHP / battle.raikouMaxHP) * 100;
  const playerHpPercent = (battle.playerHP / battle.playerMaxHP) * 100;
  const captureRatePercent = (calculateCaptureRate(raikouHpPercent / 100) * 100).toFixed(1);

  return (
    <div className="h-dvh w-full bg-[#0a0520] flex flex-col" style={{ fontFamily: "'Courier New', monospace" }}>
      {/* Battle scene */}
      <div className="relative flex-1 overflow-hidden" style={{ background: "linear-gradient(180deg, #181028 0%, #2a1845 45%, #483068 75%, #5a3878 100%)" }}>
        {/* Stars */}
        <div className="absolute inset-0 opacity-60">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: "2px", height: "2px", background: i % 3 === 0 ? "#fbbf24" : "#fff",
              top: `${Math.random() * 50}%`, left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.3,
            }} />
          ))}
        </div>

        {/* Mountains silhouette */}
        <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 320 100" preserveAspectRatio="none" style={{ height: "30%" }}>
          <path d="M 0 100 L 0 60 L 30 30 L 60 50 L 90 25 L 120 45 L 150 30 L 180 50 L 210 30 L 240 50 L 270 30 L 300 45 L 320 35 L 320 100 Z" fill="#1a0f30" />
        </svg>

        {/* Raikou info box (top left) */}
        <div className="absolute top-4 left-4 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 z-10" style={{ boxShadow: "4px 4px 0 #000", minWidth: "200px" }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-black">RAIKOU</span>
            <span className="text-[10px] text-gray-700">♂ Niv.{RAIKOU_LEVEL}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="w-32 h-2 bg-black border border-black" style={{ padding: "1px" }}>
              <div style={{
                width: `${raikouHpPercent}%`,
                height: "100%",
                background: raikouHpPercent > 50 ? "#58c050" : raikouHpPercent > 20 ? "#f8c840" : "#e03030",
                transition: "width 0.5s",
              }} />
            </div>
          </div>
          <div className="text-[9px] text-gray-600 mt-1">
            Capture: <span className="font-bold text-black">{captureRatePercent}%</span>
          </div>
        </div>

        {/* Raikou sprite */}
        <div className="absolute top-4 right-4 z-5">
          <img
            src="https://play.pokemonshowdown.com/sprites/ani/raikou.gif"
            alt="Raikou"
            style={{ imageRendering: "pixelated", width: "120px" }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        </div>

        {/* Player pokemon (bottom left of scene) */}
        <div className="absolute bottom-4 left-8 z-5">
          {pokemonData?.spriteAnimated ? (
            <img src={pokemonData.spriteAnimated} alt={selectedPokemon?.name} style={{ imageRendering: "pixelated", width: "120px", transform: "scaleX(-1)" }} />
          ) : pokemonData?.sprite ? (
            <img src={pokemonData.sprite} alt={selectedPokemon?.name} style={{ width: "120px", transform: "scaleX(-1)" }} />
          ) : null}
        </div>

        {/* Player info box (bottom right of scene) */}
        <div className="absolute bottom-4 right-4 bg-[#f8f0e0] border-[3px] border-black p-2 px-3 z-10" style={{ boxShadow: "4px 4px 0 #000", minWidth: "200px" }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-black">{selectedPokemon?.name.toUpperCase()}</span>
            <span className="text-[10px] text-gray-700">Niv.{selectedPokemon?.level}</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[9px] font-bold text-black">PV</span>
            <div className="w-32 h-2 bg-black border border-black" style={{ padding: "1px" }}>
              <div style={{
                width: `${playerHpPercent}%`,
                height: "100%",
                background: playerHpPercent > 50 ? "#58c050" : playerHpPercent > 20 ? "#f8c840" : "#e03030",
                transition: "width 0.5s",
              }} />
            </div>
            <span className="text-[9px] text-black font-bold">{battle.playerHP}/{battle.playerMaxHP}</span>
          </div>
        </div>
      </div>

      {/* HUD */}
      <div className="bg-[#f8f0e0] border-t-4 border-black p-3" style={{ minHeight: "200px" }}>
        {/* Dialog */}
        <div className="bg-white border-[3px] border-black p-3 mb-3 min-h-[60px]" style={{ boxShadow: "4px 4px 0 #000" }}>
          {battle.log.slice(-2).map((line, i) => (
            <p key={i} className="text-sm text-black font-bold" style={{ lineHeight: "1.5" }}>{line}</p>
          ))}
        </div>

        {/* Menu */}
        {menuMode === "main" ? (
          <div className="grid grid-cols-2 gap-2 ml-auto" style={{ maxWidth: "400px", marginLeft: "auto" }}>
            <button
              disabled={battle.busy}
              onClick={() => setMenuMode("moves")}
              className="bg-white border-[3px] border-black p-2 text-sm font-bold text-black hover:bg-[#ffe080] disabled:opacity-40"
              style={{ boxShadow: "3px 3px 0 #000", fontFamily: "'Courier New', monospace" }}
            >
              ▶ ATTAQUE
            </button>
            <button
              disabled={battle.busy || battle.pokeballsLeft === 0}
              onClick={onCatch}
              className="bg-white border-[3px] border-black p-2 text-sm font-bold text-black hover:bg-[#ffe080] disabled:opacity-40"
              style={{ boxShadow: "3px 3px 0 #000", fontFamily: "'Courier New', monospace" }}
            >
              ▶ CAPTURE ({battle.pokeballsLeft})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {moves.map((m, i) => (
              <button
                key={i}
                disabled={battle.busy}
                onClick={() => onAttack(i)}
                className="bg-white border-[3px] border-black p-2 text-xs font-bold hover:bg-[#ffe080] disabled:opacity-40 text-left"
                style={{ boxShadow: "3px 3px 0 #000", fontFamily: "'Courier New', monospace" }}
              >
                <div>{m.name.toUpperCase()}</div>
                <div className="text-[9px] text-gray-600">PUI: {m.power}</div>
              </button>
            ))}
            <button
              onClick={() => setMenuMode("main")}
              className="col-span-2 text-xs text-gray-700 underline mt-1"
            >
              ← Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   RESULT SCREEN
   ═══════════════════════════════════════════════ */

function ResultScreen({ type, pseudo, onClose }: { type: "victory" | "defeat" | "fled"; pseudo: string; onClose: () => void }) {
  const messages = {
    victory: { title: "VICTOIRE !", text: `Bravo ${pseudo} ! Tu as capturé RAIKOU !`, color: "#fbbf24" },
    defeat: { title: "DÉFAITE…", text: "Ton Pokémon est K.O. ou plus de Pokéballs.", color: "#e03030" },
    fled: { title: "RAIKOU S'ENFUIT", text: "Tu as mis K.O. RAIKOU. Il s'est enfui dans la nuit…", color: "#94a3b8" },
  };
  const m = messages[type];

  return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#0a0520] p-6" style={{ fontFamily: "'Courier New', monospace" }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#f8f0e0] border-4 border-black p-8 max-w-sm text-center"
        style={{ boxShadow: "8px 8px 0 #000" }}
      >
        <h1 className="text-2xl font-bold mb-4" style={{ color: m.color }}>{m.title}</h1>
        <p className="text-sm text-black mb-6">{m.text}</p>
        <button onClick={onClose} className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-gray-800">
          FERMER
        </button>
      </motion.div>
    </div>
  );
}
