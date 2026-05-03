"use client";

import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getBossPhase, PHASE_NAMES, PHASE_COLORS, BEAST_CONFIGS, HOOH_MAX_HP, type BossPhase } from "../lib/battleSystem";

/* ═══════════════════════════════════════════════
   SHOWDOWN-STYLE SPECTATOR VIEW
   Embeddable in admin panel — watches a single player's battle live
   ═══════════════════════════════════════════════ */

interface LiveData {
  pseudo: string;
  pokemon: string;
  currentPokemon: string | null;
  currentPokemonHP: number;
  currentPokemonMaxHP: number;
  raikouHP: number;   // reused for boss HP
  raikouMaxHP: number;
  pokeballsLeft: number;
  lastAction: string;
  battlePhase: string | null;
  currentBeast: string | null;
  bossPhase: string | null;
  beastsDefeated: number | null;
  log: string[];
  updatedAt: number;
}

export function SpectatorView({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [offline, setOffline] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [fullLog, setFullLog] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "liveBattles", deviceId), (snap) => {
      if (!snap.exists()) { setOffline(true); return; }
      setOffline(false);
      const d = snap.data() as any;
      setData({
        pseudo: d.pseudo || "???",
        pokemon: d.pokemon || "???",
        currentPokemon: d.currentPokemon,
        currentPokemonHP: d.currentPokemonHP ?? 0,
        currentPokemonMaxHP: d.currentPokemonMaxHP ?? 1,
        raikouHP: d.raikouHP ?? 0,
        raikouMaxHP: d.raikouMaxHP ?? 1,
        pokeballsLeft: d.pokeballsLeft ?? 0,
        lastAction: d.lastAction || "",
        battlePhase: d.battlePhase || null,
        currentBeast: d.currentBeast || null,
        bossPhase: d.bossPhase || null,
        beastsDefeated: d.beastsDefeated ?? null,
        log: d.log || [],
        updatedAt: d.updatedAt?.toMillis?.() ?? Date.now(),
      });
      // Append new log entries
      if (d.log && d.log.length > 0) {
        setFullLog((prev) => {
          const newEntries = d.log.filter((l: string) => !prev.includes(l));
          return [...prev, ...newEntries].slice(-50);
        });
      }
      if (d.lastAction) {
        setFullLog((prev) => {
          if (prev[prev.length - 1] !== d.lastAction) {
            return [...prev, d.lastAction].slice(-50);
          }
          return prev;
        });
      }
    });
    return unsub;
  }, [deviceId]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [fullLog]);

  if (offline || !data) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0d1117] text-gray-500 text-sm" style={{ fontFamily: "'Courier New', monospace" }}>
        <div className="text-center">
          <p className="mb-2">Combat terminé ou joueur hors ligne</p>
          <button onClick={onClose} className="text-xs text-blue-400 hover:underline">← Retour</button>
        </div>
      </div>
    );
  }

  const isBeasts = data.battlePhase === "beasts";
  const isHoOh = data.battlePhase === "hooh" || data.pokemon === "ho-oh";
  const bossHP = data.raikouHP;
  const bossMaxHP = data.raikouMaxHP;
  const bossHpPct = bossMaxHP > 0 ? (bossHP / bossMaxHP) * 100 : 0;
  const playerHpPct = data.currentPokemonMaxHP > 0 ? (data.currentPokemonHP / data.currentPokemonMaxHP) * 100 : 0;
  const hpCol = (p: number) => p > 50 ? "#4ade80" : p > 20 ? "#fbbf24" : "#ef4444";
  const bp: BossPhase = (data.bossPhase as BossPhase) || "sacred";
  const pc = PHASE_COLORS[bp] || PHASE_COLORS.sacred;

  // Determine boss display info
  let bossName = "???";
  let bossSprite = "";
  let bossColor = "#888";
  let bossLevel = "??";

  if (isBeasts && data.currentBeast) {
    const beast = BEAST_CONFIGS.find((b) => b.name === data.currentBeast);
    if (beast) {
      bossName = beast.displayName;
      bossSprite = beast.sprite;
      bossColor = beast.color;
      bossLevel = String(beast.level);
    }
  } else if (isHoOh) {
    bossName = "HO-OH";
    bossSprite = "https://play.pokemonshowdown.com/sprites/ani/ho-oh.gif";
    bossColor = pc.primary;
    bossLevel = "150";
  } else {
    bossName = data.pokemon.toUpperCase();
    bossSprite = `https://play.pokemonshowdown.com/sprites/ani/${data.pokemon}.gif`;
    bossColor = "#fbbf24";
    bossLevel = "??";
  }

  const playerSprite = data.currentPokemon
    ? `https://play.pokemonshowdown.com/sprites/ani/${data.currentPokemon.toLowerCase().replace(/[^a-z0-9-]/g, "")}.gif`
    : "";

  return (
    <div className="h-full flex flex-col bg-[#0d1117] text-white overflow-hidden" style={{ fontFamily: "Verdana, 'Helvetica Neue', sans-serif" }}>
      {/* Header bar — Showdown style */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-[11px] text-[#8b949e] hover:text-white transition-colors">← Retour</button>
          <div className="w-px h-4 bg-[#30363d]" />
          <span className="text-[12px] font-bold text-[#c9d1d9]">{data.pseudo}</span>
          <span className="text-[10px] text-[#8b949e]">vs {bossName}</span>
        </div>
        <div className="flex items-center gap-2">
          {isHoOh && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: pc.glow, color: pc.primary }}>
              {PHASE_NAMES[bp]}
            </span>
          )}
          {isBeasts && data.beastsDefeated !== null && (
            <span className="text-[9px] text-[#8b949e]">Bêtes: {data.beastsDefeated}/3</span>
          )}
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] text-[#8b949e]">LIVE</span>
        </div>
      </div>

      {/* Battle field — Showdown layout */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative overflow-hidden" style={{
          background: isHoOh
            ? bp === "divine" ? "linear-gradient(180deg, #1a1400 0%, #2d1e00 40%, #1a1200 100%)"
            : bp === "rage" ? "linear-gradient(180deg, #1a0400 0%, #2d0800 40%, #1a0400 100%)"
            : "linear-gradient(180deg, #1a0a04 0%, #2d1810 40%, #1a0c04 100%)"
            : isBeasts
            ? "linear-gradient(180deg, #0a0520 0%, #1a0c35 40%, #0a0518 100%)"
            : "linear-gradient(180deg, #0d1117 0%, #161b22 40%, #0d1117 100%)",
        }}>
          {/* Boss section — adapts between 3v3 beasts and 1v1 Ho-Oh */}
          {isBeasts ? (
            /* 3v3 BEASTS VIEW */
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-4 sm:gap-8 z-10 px-4">
              {BEAST_CONFIGS.map((b, i) => {
                const isActive = data.currentBeast === b.name;
                const hpPct = i === 0 ? bossHpPct :
                              i === 1 ? (data.raikouMaxHP > 0 ? (data.raikouHP / data.raikouMaxHP) * 100 : 100) :
                              100; // approximate — we only track the focused beast
                return (
                  <div key={i} className="text-center" style={{ opacity: isActive ? 1 : 0.6 }}>
                    <img src={b.sprite} alt={b.name}
                      style={{ imageRendering: "pixelated", width: "70px", margin: "0 auto",
                        filter: isActive ? `drop-shadow(0 0 12px ${b.glowColor})` : "grayscale(0.5)",
                        animation: isActive ? "showdown-float 3s ease-in-out infinite" : "none" }}
                      onError={e => { e.currentTarget.style.display = "none"; }} />
                    <div className="mt-1" style={{ width: "70px", margin: "4px auto 0" }}>
                      <div className="text-[9px] font-bold mb-0.5" style={{ color: b.color }}>{b.displayName}</div>
                      {isActive && (
                        <div className="h-1.5 bg-[#30363d] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${bossHpPct}%`, background: hpCol(bossHpPct) }} />
                        </div>
                      )}
                      {isActive && <div className="text-[8px] font-mono mt-0.5" style={{ color: hpCol(bossHpPct) }}>{Math.round(bossHpPct)}%</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 1v1 HO-OH VIEW */
            <>
              <div className="absolute top-4 right-4 z-10 flex items-start gap-3 max-w-[60%]">
                <div className="flex-1 text-right">
                  <div className="flex items-baseline justify-end gap-2 mb-1">
                    <span className="text-[13px] font-bold" style={{ color: bossColor }}>{bossName}</span>
                    <span className="text-[10px] text-[#8b949e]">L{bossLevel}</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <div className="w-36 h-[6px] bg-[#30363d] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${bossHpPct}%`, background: hpCol(bossHpPct),
                        boxShadow: `0 0 6px ${hpCol(bossHpPct)}40`,
                      }} />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: hpCol(bossHpPct) }}>{Math.round(bossHpPct)}%</span>
                  </div>
                </div>
              </div>
              <div className="absolute right-[15%] top-[30%] z-5">
                {bossSprite && (
                  <img src={bossSprite} alt={bossName}
                    style={{ imageRendering: "pixelated", width: "120px", filter: `drop-shadow(0 0 12px ${bossColor}40)`,
                      animation: "showdown-float 3s ease-in-out infinite" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                )}
              </div>
            </>
          )}

          {/* Player side (bottom-left) — Showdown convention */}
          <div className="absolute bottom-4 left-4 z-10 max-w-[60%]">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[13px] font-bold text-white">{(data.currentPokemon || "???").toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-32 h-[6px] bg-[#30363d] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${playerHpPct}%`, background: hpCol(playerHpPct),
                }} />
              </div>
              <span className="text-[10px] font-mono" style={{ color: hpCol(playerHpPct) }}>
                {data.currentPokemonHP}/{data.currentPokemonMaxHP}
              </span>
            </div>
            {/* Pokeballs */}
            <div className="flex gap-1 mt-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-full" style={{
                  background: i >= data.pokeballsLeft ? "#30363d" : "linear-gradient(180deg, #ef4444 50%, #fff 50%)",
                  border: "1px solid #000", opacity: i >= data.pokeballsLeft ? 0.3 : 1,
                }} />
              ))}
            </div>
          </div>

          {/* Player sprite (center-left) */}
          <div className="absolute left-[10%] bottom-[25%] z-5">
            {playerSprite && (
              <img src={playerSprite} alt={data.currentPokemon || ""}
                style={{ imageRendering: "pixelated", width: "90px", transform: "scaleX(-1)", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.4))" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}
          </div>

          {/* VS indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-10">
            <span className="text-5xl font-black text-white">VS</span>
          </div>
        </div>

        {/* Battle log — Showdown style scrolling log */}
        <div ref={logRef} className="h-[180px] min-h-[140px] bg-[#0d1117] border-t border-[#30363d] overflow-y-auto px-3 py-2 text-[12px] leading-relaxed"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          {fullLog.map((line, i) => (
            <div key={i} className="py-0.5" style={{
              color: line.includes("K.O.") || line.includes("DÉFAITE") ? "#f87171"
                : line.includes("super efficace") ? "#4ade80"
                : line.includes("CAPTURÉ") || line.includes("VICTOIRE") ? "#fbbf24"
                : line.includes("utilise") ? "#c9d1d9"
                : "#8b949e",
            }}>
              {line}
            </div>
          ))}
          {fullLog.length === 0 && (
            <div className="text-[#30363d] italic">En attente d'actions…</div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes showdown-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}