"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

/* ═══════════════════════════════════════════════
   PLAYER PROGRESS DASHBOARD
   Vue admin — qui est à quelle phase en temps réel
   À intégrer dans le panel admin
   ═══════════════════════════════════════════════ */

interface PlayerProgress {
  pseudo: string;
  quizPassed: boolean;
  quizScore: number;
  beastsPassed: boolean;
  beastsDefeated: number;
  updatedAt?: number;
}

interface LiveBattle {
  pseudo: string;
  battlePhase: string | null; // "beasts" | "hooh"
  bossPhase: string | null;   // "sacred" | "rage" | "divine"
  beastsDefeated: number | null;
  raikouHP: number | null;
  raikouMaxHP: number | null;
  updatedAt: number;
}

type Phase = "quiz" | "beasts" | "hooh";

const PHASE_CONFIG = {
  quiz: {
    label: "Quiz Kimono",
    emoji: "📜",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.3)",
    desc: "Pas encore passé le quiz",
  },
  beasts: {
    label: "3v3 Légendaires",
    emoji: "⚔️",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.3)",
    desc: "Combat contre Raikou / Entei / Suicune",
  },
  hooh: {
    label: "Boss Ho-Oh",
    emoji: "🌈",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.3)",
    desc: "Face au boss final",
  },
};

export function PlayerProgressDashboard() {
  const [progress, setProgress] = useState<Map<string, PlayerProgress>>(new Map());
  const [liveBattles, setLiveBattles] = useState<Map<string, LiveBattle>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ── Firestore: eventProgress (qui a passé quoi) ──────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "eventProgress"), (snap) => {
      const map = new Map<string, PlayerProgress>();
      snap.forEach(doc => {
        const d = doc.data();
        map.set(d.pseudo ?? doc.id, {
          pseudo: d.pseudo ?? doc.id,
          quizPassed: Boolean(d.quizPassed),
          quizScore: d.quizScore ?? 0,
          beastsPassed: Boolean(d.beastsPassed),
          beastsDefeated: d.beastsDefeated ?? 0,
          updatedAt: d.updatedAt?.toMillis?.() ?? Date.now(),
        });
      });
      setProgress(map);
      setLastUpdate(new Date());
    });
    return unsub;
  }, []);

  // ── Firestore: liveBattles (qui combat en ce moment) ─────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "liveBattles"), (snap) => {
      const map = new Map<string, LiveBattle>();
      const now = Date.now();
      snap.forEach(doc => {
        const d = doc.data();
        const updatedAt = d.updatedAt?.toMillis?.() ?? 0;
        if (now - updatedAt < 3 * 60 * 1000) { // actif dans les 3 dernières min
          map.set(d.pseudo, {
            pseudo: d.pseudo,
            battlePhase: d.battlePhase ?? null,
            bossPhase: d.bossPhase ?? null,
            beastsDefeated: d.beastsDefeated ?? null,
            raikouHP: d.raikouHP ?? null,
            raikouMaxHP: d.raikouMaxHP ?? null,
            updatedAt,
          });
        }
      });
      setLiveBattles(map);
    });
    return unsub;
  }, []);

  // ── Catégorisation des joueurs ───────────────────────────────────
  const players = Array.from(progress.values());

  const byPhase: Record<Phase, PlayerProgress[]> = {
    quiz:   players.filter(p => !p.quizPassed),
    beasts: players.filter(p => p.quizPassed && !p.beastsPassed),
    hooh:   players.filter(p => p.beastsPassed),
  };

  const total = players.length;

  return (
    <div style={{ fontFamily: "'Courier New', monospace", color: "#c9d1d9" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-black text-white">Progression des joueurs</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {total} joueur{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""}
            {lastUpdate && ` · MàJ ${lastUpdate.toLocaleTimeString("fr-FR")}`}
          </p>
        </div>
        <div className="flex gap-2">
          {(Object.entries(byPhase) as [Phase, PlayerProgress[]][]).map(([phase, list]) => (
            <div key={phase} className="text-center px-3 py-1.5 rounded border"
              style={{ background: PHASE_CONFIG[phase].bg, borderColor: PHASE_CONFIG[phase].border }}>
              <div className="text-lg font-black" style={{ color: PHASE_CONFIG[phase].color }}>{list.length}</div>
              <div className="text-[8px] text-gray-500">{PHASE_CONFIG[phase].emoji}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(byPhase) as [Phase, PlayerProgress[]][]).map(([phase, list]) => {
          const cfg = PHASE_CONFIG[phase];
          return (
            <div key={phase} className="rounded-lg border overflow-hidden"
              style={{ background: cfg.bg, borderColor: cfg.border }}>
              {/* Column header */}
              <div className="px-3 py-2 border-b" style={{ borderColor: cfg.border }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{cfg.emoji}</span>
                  <div>
                    <div className="text-[11px] font-black" style={{ color: cfg.color }}>{cfg.label}</div>
                    <div className="text-[8px] text-gray-500">{list.length} joueur{list.length > 1 ? "s" : ""}</div>
                  </div>
                </div>
              </div>

              {/* Player cards */}
              <div className="p-2 flex flex-col gap-1.5 min-h-[80px] max-h-[320px] overflow-y-auto">
                {list.length === 0 && (
                  <div className="text-center py-4 text-[9px] text-gray-600 italic">Aucun joueur</div>
                )}
                {list.map(p => {
                  const live = liveBattles.get(p.pseudo);
                  const isActive = !!live;
                  return (
                    <PlayerCard
                      key={p.pseudo}
                      player={p}
                      phase={phase}
                      live={live}
                      isActive={isActive}
                      phaseColor={cfg.color}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live battles legend */}
      {liveBattles.size > 0 && (
        <div className="mt-3 flex items-center gap-2 text-[9px] text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>{liveBattles.size} combat{liveBattles.size > 1 ? "s" : ""} en cours</span>
        </div>
      )}
    </div>
  );
}

/* ── Player Card ──────────────────────────────────────────────────── */
function PlayerCard({
  player, phase, live, isActive, phaseColor,
}: {
  player: PlayerProgress;
  phase: Phase;
  live: LiveBattle | undefined;
  isActive: boolean;
  phaseColor: string;
}) {
  return (
    <div className="rounded px-2.5 py-2 border transition-all"
      style={{
        background: isActive ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
        borderColor: isActive ? `${phaseColor}50` : "rgba(255,255,255,0.06)",
        boxShadow: isActive ? `0 0 8px ${phaseColor}20` : "none",
      }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isActive && (
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          )}
          <span className="text-[11px] font-bold text-white truncate">{player.pseudo}</span>
        </div>
        <PhaseDetail player={player} phase={phase} live={live} />
      </div>

      {/* Live battle info */}
      {live && phase === "beasts" && live.beastsDefeated !== null && (
        <div className="mt-1 flex gap-1">
          {["Raikou", "Entei", "Suicune"].map((b, i) => (
            <div key={b} className="text-[7px] px-1 py-0.5 rounded"
              style={{
                background: (live.beastsDefeated ?? 0) > i ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
                color: (live.beastsDefeated ?? 0) > i ? "#22c55e" : "#4b5563",
                border: `1px solid ${(live.beastsDefeated ?? 0) > i ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}>
              {b.substring(0, 3)}
            </div>
          ))}
        </div>
      )}

      {live && phase === "hooh" && live.bossPhase && (
        <div className="mt-1">
          <div className="text-[7px] font-bold"
            style={{ color: live.bossPhase === "divine" ? "#fbbf24" : live.bossPhase === "rage" ? "#ef4444" : "#f59e0b" }}>
            {live.bossPhase === "divine" ? "⚡ Phase III — Jugement Divin" :
             live.bossPhase === "rage"   ? "🔥 Phase II — Colère Ardente" :
                                           "✦ Phase I — Flamme Sacrée"}
          </div>
          {live.raikouHP !== null && live.raikouMaxHP && live.raikouMaxHP > 0 && (
            <div className="mt-0.5 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${(live.raikouHP / live.raikouMaxHP) * 100}%`,
                  background: live.raikouHP / live.raikouMaxHP > 0.5 ? "#22c55e" :
                              live.raikouHP / live.raikouMaxHP > 0.2 ? "#f59e0b" : "#ef4444",
                }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Phase Detail Badge ───────────────────────────────────────────── */
function PhaseDetail({ player, phase, live }: {
  player: PlayerProgress; phase: Phase; live: LiveBattle | undefined;
}) {
  if (phase === "quiz") {
    return (
      <span className="text-[8px] text-gray-500 flex-shrink-0">
        {player.quizScore > 0 ? `${player.quizScore}/10` : "—"}
      </span>
    );
  }
  if (phase === "beasts") {
    return (
      <span className="text-[8px] flex-shrink-0" style={{ color: "#f59e0b" }}>
        {player.beastsDefeated}/3
      </span>
    );
  }
  if (phase === "hooh") {
    return (
      <span className="text-[8px] flex-shrink-0" style={{ color: "#22c55e" }}>
        ✓ qualifié
      </span>
    );
  }
  return null;
}
