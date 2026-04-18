"use client";

import { useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { functions, db } from "../../lib/firebase";
import { SpectatorView } from "../../components/SpectatorView";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<"control" | "live" | "progress" | "winners">("control");

  // Event state
  const [eventActive, setEventActive] = useState(false);
  const [eventType, setEventType] = useState("normal");
  const [eventPhase, setEventPhase] = useState<string | null>(null);
  const [eventPokemon, setEventPokemon] = useState("suicune");

  // Live battles
  const [liveBattles, setLiveBattles] = useState<any[]>([]);
  const [battleResults, setBattleResults] = useState<any[]>([]);
  const [spectatingId, setSpectatingId] = useState<string | null>(null);

  // Player progress (boss event)
  const [progress, setProgress] = useState<any[]>([]);

  // Winners
  const [winners, setWinners] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  // Listen to event doc
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "events")),
      (snap) => {
        snap.forEach((doc) => {
          if (doc.id === "current") {
            const d = doc.data();
            setEventActive(d.active === true);
            setEventType(d.eventType || "normal");
            setEventPhase(d.phase || null);
            setEventPokemon(d.pokemon || "suicune");
          }
        });
      }
    );
    return unsub;
  }, []);

  // Listen to live battles in real-time
  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(collection(db, "liveBattles"), (snap) => {
      const battles: any[] = [];
      const now = Date.now();
      snap.forEach((doc) => {
        const d = doc.data();
        const updatedAt = d.updatedAt?.toMillis?.() ?? 0;
        if (now - updatedAt < 120000) {
          battles.push({ id: doc.id, ...d, updatedAt });
        }
      });
      battles.sort((a, b) => b.updatedAt - a.updatedAt);
      setLiveBattles(battles);
    });
    return unsub;
  }, [authed]);

  // Listen to event progress
  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(collection(db, "eventProgress"), (snap) => {
      const players: any[] = [];
      snap.forEach((doc) => { players.push({ id: doc.id, ...doc.data() }); });
      players.sort((a, b) => (b.quizScore || 0) - (a.quizScore || 0));
      setProgress(players);
    });
    return unsub;
  }, [authed]);

  const callFn = useCallback(async (name: string, data: any) => {
    setBusy(true);
    try {
      const fn = httpsCallable(functions, name);
      const res = await fn({ ...data, password });
      return (res.data as any);
    } catch (err: any) {
      setAuthError(err.message || "Erreur");
      return null;
    } finally { setBusy(false); }
  }, [password]);

  const login = async () => {
    const res = await callFn("getWinners", {});
    if (res) { setAuthed(true); setAuthError(""); setWinners(res.winners || []); }
  };

  const startBossEvent = async () => {
    await callFn("startEvent", {
      durationSeconds: 3600, pokemon: "ho-oh",
      eventType: "boss_event", phase: "quiz",
    });
  };

  const startNormalEvent = async (pokemon: string, duration: number) => {
    await callFn("startEvent", { durationSeconds: duration, pokemon, eventType: "normal" });
  };

  const setPhase = async (phase: string) => {
    await callFn("setEventPhase", { phase });
  };

  const stopEvent = async () => { await callFn("stopEvent", {}); };

  const refreshWinners = async () => {
    const res = await callFn("getWinners", {});
    if (res) setWinners(res.winners || []);
    const s = await callFn("getCaptureStats", {});
    if (s) setStats(s);
  };

  if (!authed) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-[#0d1117] p-6" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-sm w-full">
          <h1 className="text-lg font-bold text-white mb-4">🔒 Admin RPPLF</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Mot de passe" autoFocus
            className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm mb-3 outline-none focus:border-blue-500" />
          {authError && <p className="text-red-400 text-xs mb-2">{authError}</p>}
          <button onClick={login} disabled={busy}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-semibold py-2 rounded disabled:opacity-50">
            {busy ? "…" : "Connexion"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex bg-[#0d1117] text-[#c9d1d9] overflow-hidden" style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "13px" }}>
      {/* LEFT PANEL */}
      <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-[#30363d] overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#30363d] bg-[#161b22]">
          {(["control", "live", "progress", "winners"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === "winners") refreshWinners(); }}
              className="flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors"
              style={{
                color: tab === t ? "#58a6ff" : "#8b949e",
                borderBottom: tab === t ? "2px solid #58a6ff" : "2px solid transparent",
                background: tab === t ? "#0d1117" : "transparent",
              }}>
              {t === "control" ? "⚙️ Contrôle" : t === "live" ? `🎮 Live (${liveBattles.length})` : t === "progress" ? `📊 Joueurs (${progress.length})` : `🏆 Gagnants`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* CONTROL TAB */}
          {tab === "control" && (
            <div className="space-y-3">
              {/* Status */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#8b949e]">ÉTAT</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${eventActive ? "bg-green-900/30 text-green-400" : "bg-red-900/20 text-red-400"}`}>
                    {eventActive ? "EN COURS" : "INACTIF"}
                  </span>
                </div>
                {eventActive && (
                  <div className="text-xs text-[#8b949e] space-y-1">
                    <p>Pokémon : <strong className="text-white">{eventPokemon}</strong></p>
                    <p>Type : <strong className="text-white">{eventType}</strong></p>
                    {eventPhase && <p>Phase : <strong className="text-amber-400">{eventPhase.toUpperCase()}</strong></p>}
                  </div>
                )}
              </div>

              {/* Boss Event controls */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
                <h3 className="text-xs font-bold text-amber-400 mb-2">🔥 BOSS EVENT (Ho-Oh)</h3>
                {!eventActive ? (
                  <button onClick={startBossEvent} disabled={busy}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2 rounded disabled:opacity-50">
                    Lancer Boss Event (1h)
                  </button>
                ) : eventType === "boss_event" ? (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {(["quiz", "beasts", "hooh"] as const).map((p) => (
                        <button key={p} onClick={() => setPhase(p)} disabled={busy || eventPhase === p}
                          className="flex-1 text-[10px] font-bold py-1.5 rounded border transition-colors"
                          style={{
                            borderColor: eventPhase === p ? "#f59e0b" : "#30363d",
                            background: eventPhase === p ? "#f59e0b20" : "transparent",
                            color: eventPhase === p ? "#f59e0b" : "#8b949e",
                          }}>
                          {p === "quiz" ? "📝 Quiz" : p === "beasts" ? "⚔️ Bêtes" : "🔥 Ho-Oh"}
                        </button>
                      ))}
                    </div>
                    <button onClick={stopEvent} disabled={busy}
                      className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-bold py-1.5 rounded border border-red-800/30">
                      Arrêter l'event
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#8b949e]">Un event normal est en cours. Arrêtez-le d'abord.</p>
                )}
              </div>

              {/* Normal events */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
                <h3 className="text-xs font-bold text-[#8b949e] mb-2">EVENTS NORMAUX</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { name: "suicune", label: "Suicune", color: "#38bdf8" },
                    { name: "entei", label: "Entei", color: "#ef4444" },
                    { name: "raikou", label: "Raikou", color: "#fbbf24" },
                  ].map((p) => (
                    <button key={p.name} onClick={() => startNormalEvent(p.name, 600)} disabled={busy || eventActive}
                      className="text-[10px] font-bold py-2 rounded border border-[#30363d] hover:border-[#484f58] disabled:opacity-30 transition-colors"
                      style={{ color: p.color }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {eventActive && eventType === "normal" && (
                  <button onClick={stopEvent} disabled={busy}
                    className="w-full mt-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-bold py-1.5 rounded border border-red-800/30">
                    Stop
                  </button>
                )}
              </div>
            </div>
          )}

          {/* LIVE TAB */}
          {tab === "live" && (
            <div className="space-y-2">
              {liveBattles.length === 0 ? (
                <div className="text-center text-[#30363d] py-8">
                  <p className="text-2xl mb-2">🎮</p>
                  <p className="text-xs">Aucun combat en cours</p>
                </div>
              ) : (
                liveBattles.map((b) => {
                  const hpPct = b.raikouMaxHP > 0 ? Math.round((b.raikouHP / b.raikouMaxHP) * 100) : 0;
                  const isWatching = spectatingId === b.id;
                  return (
                    <button key={b.id} onClick={() => setSpectatingId(isWatching ? null : b.id)}
                      className="w-full text-left bg-[#161b22] border rounded-lg p-3 transition-colors hover:border-[#484f58]"
                      style={{ borderColor: isWatching ? "#58a6ff" : "#30363d" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-bold text-white">{b.pseudo}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{
                            background: b.battlePhase === "hooh" ? "#f59e0b20" : b.battlePhase === "beasts" ? "#38bdf820" : "#8b949e20",
                            color: b.battlePhase === "hooh" ? "#f59e0b" : b.battlePhase === "beasts" ? "#38bdf8" : "#8b949e",
                          }}>
                          {b.battlePhase === "hooh" ? "Ho-Oh" : b.battlePhase === "beasts" ? (b.currentBeast || "Bêtes") : b.pokemon}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#8b949e]">
                        <span>vs {b.currentPokemon || "?"}</span>
                        <span>·</span>
                        <span>Boss: <strong style={{ color: hpPct > 50 ? "#4ade80" : hpPct > 20 ? "#fbbf24" : "#ef4444" }}>{hpPct}%</strong></span>
                        <span>·</span>
                        <span>🔴×{b.pokeballsLeft ?? "?"}</span>
                      </div>
                      <div className="text-[9px] text-[#484f58] mt-1 truncate italic">{b.lastAction}</div>
                      {isWatching && (
                        <div className="mt-1.5 text-[9px] text-[#58a6ff] font-bold">👁️ Spectating → panneau droit</div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* PROGRESS TAB */}
          {tab === "progress" && (
            <div className="space-y-1.5">
              {progress.length === 0 ? (
                <div className="text-center text-[#30363d] py-8">
                  <p className="text-xs">Aucun joueur pour l'instant</p>
                </div>
              ) : (
                progress.map((p) => (
                  <div key={p.id} className="bg-[#161b22] border border-[#30363d] rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{p.pseudo}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.quizPassed ? "bg-green-900/30 text-green-400" : "bg-red-900/20 text-red-400"}`}>
                          Quiz: {p.quizScore || 0}/{p.quizTotal || 15}
                        </span>
                        {p.quizPassed && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.beastsPassed ? "bg-green-900/30 text-green-400" : "bg-yellow-900/20 text-yellow-400"}`}>
                            Bêtes: {p.beastsDefeated || 0}/3
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* WINNERS TAB */}
          {tab === "winners" && (
            <div className="space-y-2">
              {stats && (
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-[11px] text-[#8b949e]">
                  <p>Total tentatives : <strong className="text-white">{stats.totalAttempts}</strong></p>
                  <p>Captures : <strong className="text-green-400">{stats.totalCaptures}</strong></p>
                  <p>Taux : <strong className="text-amber-400">{stats.captureRate}</strong></p>
                </div>
              )}
              {winners.map((w) => (
                <div key={w.id} className="bg-[#161b22] border border-[#30363d] rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">🏆 {w.pseudo}</span>
                    <span className="text-[10px] text-[#8b949e]">{w.pokemon}</span>
                  </div>
                  <div className="text-[9px] text-[#484f58] mt-0.5">
                    {w.timestamp ? new Date(w.timestamp).toLocaleString("fr-FR") : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Spectator View */}
      <div className="flex-1 flex flex-col min-w-0">
        {spectatingId ? (
          <SpectatorView deviceId={spectatingId} onClose={() => setSpectatingId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#0d1117] text-[#30363d]">
            <div className="text-center">
              <p className="text-4xl mb-4">👁️</p>
              <p className="text-sm font-semibold">Spectateur</p>
              <p className="text-xs mt-1">Cliquez sur un combat dans l'onglet Live</p>
              <p className="text-xs mt-0.5">pour le regarder en temps réel</p>
              <p className="text-[10px] mt-4 text-[#21262d]">Hasbi</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
