"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TYPE_COLORS, ITEMS, EV_SPREADS,
  type Move, type Item, type EVSpread, type PokemonType,
} from "../lib/battleSystem";
import type { PokemonData } from "../lib/pokeApi";
import { fetchLevelUpMoves } from "../lib/pokeApi";
import type { PlayerPokemon } from "../lib/playerRoster";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */

export interface TeamMemberConfig {
  moves: Move[];
  item: Item;
  evSpread: EVSpread;
}

export interface TeamBuilderMember {
  pokemon: PlayerPokemon;
  data: PokemonData;
  maxHP: number;
}

type Tab = "moves" | "item" | "evs";

/* ═══════════════════════════════════════════════
   TEAM BUILDER COMPONENT
   ═══════════════════════════════════════════════ */

export function TeamBuilder({
  team,
  title = "Prépare ton équipe",
  subtitle = "Configure chaque Pokémon avant le combat",
  onConfirm,
}: {
  team: TeamBuilderMember[];
  title?: string;
  subtitle?: string;
  onConfirm: (configs: TeamMemberConfig[]) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("moves");

  // Default config per pokemon
  const defaultConfig = useCallback((member: TeamBuilderMember): TeamMemberConfig => ({
    moves: [], // loaded from PokeAPI
    item: ITEMS[0], // "none"
    evSpread: EV_SPREADS[0], // "sweeper"
  }), []);

  const [configs, setConfigs] = useState<TeamMemberConfig[]>(
    () => team.map(defaultConfig)
  );

  // Resync configs when team loads asynchronously
  // (team starts empty, then fills after PokeAPI fetch)
  useEffect(() => {
    if (team.length > 0 && configs.length !== team.length) {
      setConfigs(prev => {
        // Keep existing configs, only add missing ones
        const next = [...prev];
        for (let i = prev.length; i < team.length; i++) {
          next.push(defaultConfig(team[i]));
        }
        return next;
      });
    }
  }, [team.length]);

  const current = team[selectedIdx];
  const currentConfig = configs[selectedIdx];
  const [movePool, setMovePool] = useState<Move[]>([]);
  const [movePoolLoading, setMovePoolLoading] = useState(false);

  useEffect(() => {
    if (!current) return;
    setMovePool([]);
    setMovePoolLoading(true);
    fetchLevelUpMoves(current.pokemon.name).then(moves => {
      setMovePool(moves);
      setMovePoolLoading(false);
      // Auto-set last 4 moves as default if none chosen yet
      setConfigs(prev => prev.map((c, i) => {
        if (i !== selectedIdx) return c;
        if (c.moves.length > 0) return c;
        return { ...c, moves: moves.slice(-4) };
      }));
    });
  }, [current?.pokemon.name, selectedIdx]);

  const updateConfig = useCallback((idx: number, patch: Partial<TeamMemberConfig>) => {
    setConfigs(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }, []);

  const toggleMove = useCallback((move: Move) => {
    const cur = configs[selectedIdx];
    const has = cur.moves.some(m => m.name === move.name);
    if (has) {
      // Remove (keep at least 1)
      if (cur.moves.length <= 1) return;
      updateConfig(selectedIdx, { moves: cur.moves.filter(m => m.name !== move.name) });
    } else {
      // Add (max 4)
      if (cur.moves.length >= 4) return;
      updateConfig(selectedIdx, { moves: [...cur.moves, move] });
    }
  }, [configs, selectedIdx, updateConfig]);

  const allReady = configs.every(c => c.moves.length === 4);

  if (!current) return null;

  const hpCol = (hp: number, max: number) => {
    const p = hp / max;
    return p > 0.5 ? "#22c55e" : p > 0.2 ? "#f59e0b" : "#ef4444";
  };

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden"
      style={{ fontFamily: "'Courier New', monospace", background: "radial-gradient(ellipse at 50% 20%, #2d1208, #0a0400)" }}>

      {/* Header */}
      <div className="bg-[#f8f0e0] border-b-4 border-black px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div>
            <h1 className="text-sm font-black text-black">{title}</h1>
            <p className="text-[10px] text-gray-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {configs.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div className="w-2 h-2 rounded-full" style={{
                  background: c.moves.length === 4 ? "#22c55e" : "#ef4444",
                  boxShadow: c.moves.length === 4 ? "0 0 4px #22c55e" : "none",
                }} />
              </div>
            ))}
            <span className="text-[9px] text-gray-400 ml-1">{configs.filter(c => c.moves.length === 4).length}/{configs.length} prêts</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden max-w-3xl w-full mx-auto">

        {/* ── LEFT: Team list ── */}
        <div className="w-[110px] sm:w-[140px] flex-shrink-0 bg-[#f8f0e0] border-r-4 border-black overflow-y-auto">
          {team.map((m, i) => {
            const cfg = configs[i];
            const ready = cfg.moves.length === 4;
            const active = i === selectedIdx;
            return (
              <button
                key={i}
                onClick={() => { setSelectedIdx(i); setTab("moves"); }}
                className="w-full text-left p-2 border-b-2 border-black transition-colors"
                style={{ background: active ? "#ffe080" : "transparent" }}>
                <div className="flex items-center justify-center h-12">
                  {m.data.spriteAnimated
                    ? <img src={m.data.spriteAnimated} alt={m.pokemon.name} style={{ imageRendering: "pixelated", height: "44px" }} />
                    : m.data.sprite
                    ? <img src={m.data.sprite} alt={m.pokemon.name} style={{ height: "44px" }} />
                    : null}
                </div>
                <div className="text-[9px] font-black text-black truncate">{m.pokemon.name.toUpperCase()}</div>
                <div className="text-[8px] text-gray-500">Niv. 100</div>
                <div className="flex gap-0.5 mt-1 flex-wrap">
                  {m.data.types.map(t => (
                    <span key={t} className="text-[6px] px-0.5 text-white font-bold" style={{ background: TYPE_COLORS[t] }}>{t}</span>
                  ))}
                </div>
                {/* Readiness indicator */}
                <div className="mt-1.5 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: ready ? "#22c55e" : "#ef4444" }} />
                  <span className="text-[7px]" style={{ color: ready ? "#22c55e" : "#ef4444" }}>
                    {cfg.moves.length}/4
                  </span>
                </div>
                {/* Item badge */}
                {cfg.item.effect !== "none" && (
                  <div className="text-[7px] mt-0.5 truncate" style={{ color: cfg.item.color }}>
                    {cfg.item.emoji} {cfg.item.name}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ── RIGHT: Config panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Pokémon header */}
          <div className="bg-[#f8f0e0] border-b-2 border-black px-3 py-2 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 flex items-center justify-center">
              {current.data.spriteAnimated
                ? <img src={current.data.spriteAnimated} alt="" style={{ imageRendering: "pixelated", height: "36px" }} />
                : current.data.sprite
                ? <img src={current.data.sprite} alt="" style={{ height: "36px" }} />
                : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-black text-black">{current.pokemon.name.toUpperCase()} <span className="text-gray-500 font-normal text-[10px]">Niv. 100</span></div>
              <div className="flex gap-1 mt-0.5">
                {current.data.types.map(t => (
                  <span key={t} className="text-[8px] px-1 py-0.5 text-white font-bold" style={{ background: TYPE_COLORS[t] }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-gray-500">PV max</div>
              <div className="text-[11px] font-black text-black"
                style={{ color: hpCol(currentConfig.evSpread.hpMult, 1) }}>
                {Math.floor(current.maxHP * currentConfig.evSpread.hpMult)}
              </div>
              <div className="text-[8px]" style={{ color: currentConfig.evSpread.color }}>
                {currentConfig.evSpread.emoji} {currentConfig.evSpread.name}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-black bg-[#f8f0e0] flex-shrink-0">
            {([
              { id: "moves" as Tab, label: "⚔️ Moves", warn: currentConfig.moves.length < 4 },
              { id: "item" as Tab, label: "🎒 Objet", warn: false },
              { id: "evs" as Tab, label: "📊 EVs", warn: false },
            ]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-2 text-[11px] font-bold border-r-2 border-black last:border-r-0 transition-colors relative"
                style={{ background: tab === t.id ? "#ffe080" : "transparent", color: "#000" }}>
                {t.label}
                {t.warn && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-[#f8f0e0] p-3">
            <AnimatePresence mode="wait">

              {/* ──── MOVES TAB ──── */}
              {tab === "moves" && (
                <motion.div key="moves" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-gray-600 font-bold">Sélectionne 4 attaques</p>
                    <span className="text-[10px] font-black"
                      style={{ color: currentConfig.moves.length === 4 ? "#22c55e" : "#ef4444" }}>
                      {currentConfig.moves.length}/4
                    </span>
                  </div>

                  {/* Current moves summary */}
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {Array.from({ length: 4 }).map((_, i) => {
                      const m = currentConfig.moves[i];
                      return (
                        <div key={i} className="border-[2px] border-dashed p-1.5 min-h-[36px] flex items-center"
                          style={{ borderColor: m ? TYPE_COLORS[m.type] : "#d1d5db", background: m ? `${TYPE_COLORS[m.type]}18` : "transparent" }}>
                          {m ? (
                            <div className="w-full">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-black">{m.name}</span>
                                <button onClick={() => toggleMove(m)} className="text-[8px] text-red-500 font-bold hover:text-red-700">✕</button>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[7px] px-1 text-white font-bold" style={{ background: TYPE_COLORS[m.type] }}>{m.type}</span>
                                <span className="text-[7px] text-gray-500">{m.power > 0 ? `Pui: ${m.power}` : "Statut"}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[9px] text-gray-300 italic">— vide —</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Move pool */}
                  <p className="text-[9px] text-gray-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                    Attaques apprises par niveau
                    {movePoolLoading && <span className="animate-spin inline-block w-2 h-2 border border-amber-400 border-t-transparent rounded-full" />}
                  </p>
                  {movePool.length === 0 && !movePoolLoading && (
                    <p className="text-[10px] text-gray-300 italic text-center py-4">Aucune attaque trouvée.</p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {movePool.map((m) => {
                      const selected = currentConfig.moves.some(mv => mv.name === m.name);
                      const full = !selected && currentConfig.moves.length >= 4;
                      return (
                        <button
                          key={m.name}
                          onClick={() => toggleMove(m)}
                          disabled={full}
                          className="border-[3px] p-2 text-left transition-all disabled:opacity-30 active:translate-x-[1px] active:translate-y-[1px]"
                          style={{
                            borderColor: selected ? TYPE_COLORS[m.type] : "#000",
                            background: selected ? TYPE_COLORS[m.type] : "#fff",
                            boxShadow: selected ? "none" : "2px 2px 0 #000",
                            color: selected ? "#fff" : "#000",
                          }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black truncate">{m.name}</span>
                            {selected && <span className="text-[8px] font-bold">✓</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[7px] px-1 rounded text-white font-bold"
                              style={{ background: selected ? "rgba(255,255,255,0.3)" : TYPE_COLORS[m.type] }}>{m.type}</span>
                            <span className="text-[7px] opacity-70">{m.power > 0 ? `Pui: ${m.power}` : "Statut"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ──── ITEM TAB ──── */}
              {tab === "item" && (
                <motion.div key="item" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <p className="text-[10px] text-gray-600 font-bold mb-3">Choisis un objet tenu</p>
                  <div className="flex flex-col gap-2">
                    {ITEMS.map(item => {
                      const selected = currentConfig.item.id === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => updateConfig(selectedIdx, { item })}
                          className="border-[3px] p-2.5 text-left transition-all active:translate-x-[1px] active:translate-y-[1px]"
                          style={{
                            borderColor: selected ? item.color : "#000",
                            background: selected ? `${item.color}20` : "#fff",
                            boxShadow: selected ? `0 0 8px ${item.color}40, 2px 2px 0 #000` : "2px 2px 0 #000",
                          }}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg flex-shrink-0">{item.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-black">{item.name}</span>
                                {selected && <span className="text-[9px] font-black" style={{ color: item.color }}>✓ ÉQUIPÉ</span>}
                              </div>
                              <p className="text-[9px] text-gray-600 mt-0.5">{item.description}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ──── EVS TAB ──── */}
              {tab === "evs" && (
                <motion.div key="evs" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <p className="text-[10px] text-gray-600 font-bold mb-3">Choisis une répartition d'EVs</p>
                  <div className="flex flex-col gap-2">
                    {EV_SPREADS.map(spread => {
                      const selected = currentConfig.evSpread.id === spread.id;
                      return (
                        <button
                          key={spread.id}
                          onClick={() => updateConfig(selectedIdx, { evSpread: spread })}
                          className="border-[3px] p-3 text-left transition-all active:translate-x-[1px] active:translate-y-[1px]"
                          style={{
                            borderColor: selected ? spread.color : "#000",
                            background: selected ? `${spread.color}18` : "#fff",
                            boxShadow: selected ? `0 0 8px ${spread.color}40, 2px 2px 0 #000` : "2px 2px 0 #000",
                          }}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{spread.emoji}</span>
                              <span className="text-[12px] font-black text-black">{spread.name}</span>
                            </div>
                            {selected && <span className="text-[9px] font-black" style={{ color: spread.color }}>✓ ACTIF</span>}
                          </div>
                          <p className="text-[9px] text-gray-500 mb-2">{spread.detail}</p>
                          <p className="text-[9px] text-gray-600 italic mb-2">{spread.description}</p>
                          {/* Stat preview bars */}
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { label: "PV", mult: spread.hpMult, base: current.maxHP },
                              { label: "ATQ", mult: spread.atkMult, base: 100 },
                              { label: "DEF", mult: 2 - spread.defMult, base: 100 },
                            ].map(stat => (
                              <div key={stat.label}>
                                <div className="text-[7px] text-gray-400 mb-0.5">{stat.label}</div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(100, stat.mult * 66)}%`,
                                      background: stat.mult > 1.1 ? spread.color : stat.mult < 0.95 ? "#9ca3af" : "#6ee7b7",
                                    }} />
                                </div>
                                <div className="text-[7px] font-bold mt-0.5"
                                  style={{ color: stat.mult > 1.05 ? "#22c55e" : stat.mult < 0.99 ? "#ef4444" : "#9ca3af" }}>
                                  {stat.mult > 1 ? `+${Math.round((stat.mult - 1) * 100)}%` : stat.mult < 1 ? `${Math.round((stat.mult - 1) * 100)}%` : "—"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <div className="bg-[#f8f0e0] border-t-4 border-black p-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {!allReady && (
            <p className="text-[10px] text-red-600 text-center mb-2 font-bold">
              ⚠️ Certains Pokémon ont moins de 4 attaques — complète leurs sets !
            </p>
          )}
          <button
            onClick={() => onConfirm(configs)}
            disabled={!allReady}
            className="w-full border-[4px] border-black py-3.5 text-sm font-black text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            style={{
              background: allReady ? "linear-gradient(135deg, #f59e0b, #dc2626)" : "#9ca3af",
              boxShadow: allReady ? "5px 5px 0 #000" : "none",
            }}>
            {allReady ? "CONFIRMER ET COMBATTRE →" : `${configs.filter(c => c.moves.length === 4).length}/${configs.length} équipes complètes`}
          </button>
        </div>
      </div>
    </div>
  );
}