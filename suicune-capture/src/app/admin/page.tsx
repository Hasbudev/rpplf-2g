"use client";

import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";

const POKEMON_OPTIONS = [
  { id: "suicune", label: "Suicune", color: "cyan" },
  { id: "entei", label: "Entei", color: "red" },
  { id: "raikou", label: "Raikou", color: "yellow" },
];

interface LiveBattle {
  id: string;
  pseudo: string;
  pokemon: string;
  currentPokemon: string | null;
  currentPokemonHP: number | null;
  currentPokemonMaxHP: number | null;
  raikouHP: number | null;
  raikouMaxHP: number | null;
  pokeballsLeft: number | null;
  lastAction: string;
  updatedAt: number;
}

interface BattleResult {
  id: string;
  pseudo: string;
  status: string;
  pokemon: string;
  currentPokemon: string | null;
  raikouHP: number | null;
  raikouMaxHP: number | null;
  timestamp: string | null;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [status, setStatus] = useState("");
  const [duration, setDuration] = useState(600);
  const [pokemon, setPokemon] = useState("suicune");
  const [loading, setLoading] = useState(false);
  const [winners, setWinners] = useState<any[]>([]);
  const [stats, setStats] = useState("");
  const [tab, setTab] = useState<"control" | "live" | "winners">("control");
  const [liveBattles, setLiveBattles] = useState<LiveBattle[]>([]);
  const [battleResults, setBattleResults] = useState<BattleResult[]>([]);
  const liveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const tryAuth = async () => {
    setAuthError(""); setLoading(true);
    try {
      const fn = httpsCallable(functions, "getCaptureStats");
      await fn({ password });
      setAuthenticated(true);
    } catch (err: any) {
      const msg = err?.message || "Erreur";
      setAuthError(msg.includes("permission-denied") || msg.includes("incorrect") ? "Mot de passe incorrect." : msg);
    }
    setLoading(false);
  };

  const startEvent = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "startEvent");
      const res = await fn({ password, durationSeconds: duration, pokemon });
      const d = res.data as any;
      setStatus(`Événement ${d.pokemon} lancé ! Durée: ${d.durationSeconds}s`);
    } catch (err: any) { setStatus(`Erreur: ${err.message}`); }
    setLoading(false);
  };

  const stopEvent = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "stopEvent");
      await fn({ password });
      setStatus("Événement arrêté.");
    } catch (err: any) { setStatus(`Erreur: ${err.message}`); }
    setLoading(false);
  };

  const fetchWinners = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "getWinners");
      const res = await fn({ password });
      setWinners((res.data as any).winners || []);
    } catch (err: any) { setStatus(`Erreur: ${err.message}`); }
    setLoading(false);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "getCaptureStats");
      const res = await fn({ password });
      const d = res.data as any;
      setStats(`${d.totalAttempts} tentatives, ${d.totalCaptures} captures (${d.captureRate})`);
    } catch (err: any) { setStatus(`Erreur: ${err.message}`); }
    setLoading(false);
  };

  const fetchLiveBattles = async () => {
    try {
      const fn = httpsCallable(functions, "getLiveBattles");
      const res = await fn({ password });
      const d = res.data as any;
      setLiveBattles(d.battles || []);
      setBattleResults(d.results || []);
    } catch (err: any) {
      console.error("Live fetch error:", err);
    }
  };

  // Auto-refresh live tab every 3 seconds
  useEffect(() => {
    if (authenticated && tab === "live") {
      fetchLiveBattles();
      liveIntervalRef.current = setInterval(fetchLiveBattles, 3000);
      return () => {
        if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      };
    }
  }, [authenticated, tab]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#050810] text-white flex items-center justify-center p-8">
        <div className="max-w-sm w-full">
          <h1 className="text-3xl font-black mb-2 text-center" style={{ fontFamily: "Anybody, sans-serif" }}>ADMIN</h1>
          <p className="text-sm text-white/40 mb-8 text-center">Panneau de gestion</p>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tryAuth()} placeholder="Mot de passe admin..." autoFocus className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono outline-none focus:border-cyan-400/40 mb-4 text-center" />
          {authError && <p className="text-red-400 text-sm text-center mb-4">{authError}</p>}
          <button onClick={tryAuth} disabled={loading || !password} className="w-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-semibold rounded-lg px-4 py-3 hover:bg-cyan-500/30 disabled:opacity-40 transition-colors">{loading ? "Vérification..." : "Connexion"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black mb-1" style={{ fontFamily: "Anybody, sans-serif" }}>ADMIN PANEL</h1>
            <p className="text-sm text-white/40">Gestion des événements</p>
          </div>
          <button onClick={() => { setAuthenticated(false); setPassword(""); }} className="text-xs text-white/30 hover:text-white/60 transition-colors">Déconnexion</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setTab("control")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${tab === "control" ? "text-cyan-300 border-b-2 border-cyan-400" : "text-white/40 hover:text-white/60"}`}
          >
            Contrôle
          </button>
          <button
            onClick={() => setTab("live")}
            className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${tab === "live" ? "text-yellow-300 border-b-2 border-yellow-400" : "text-white/40 hover:text-white/60"}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Live ({liveBattles.length})
          </button>
          <button
            onClick={() => setTab("winners")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${tab === "winners" ? "text-yellow-300 border-b-2 border-yellow-400" : "text-white/40 hover:text-white/60"}`}
          >
            Gagnants
          </button>
        </div>

        {/* CONTROL TAB */}
        {tab === "control" && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Contrôle événement</h2>

              <div className="mb-4">
                <label className="block text-xs text-white/40 mb-2">Pokémon</label>
                <div className="flex gap-2">
                  {POKEMON_OPTIONS.map((p) => {
                    const isSelected = pokemon === p.id;
                    const colorMap: Record<string, string> = {
                      cyan: isSelected ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300" : "bg-white/5 border-white/10 text-white/40",
                      red: isSelected ? "bg-red-500/20 border-red-400/40 text-red-300" : "bg-white/5 border-white/10 text-white/40",
                      yellow: isSelected ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-300" : "bg-white/5 border-white/10 text-white/40",
                    };
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPokemon(p.id)}
                        className={`flex-1 rounded-lg px-4 py-3 font-semibold text-sm border transition-colors ${colorMap[p.color]}`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {pokemon === "raikou" && (
                  <p className="text-xs text-yellow-400/60 mt-2">⚡ Mode combat 2D — équipe entière requise (4 badges min)</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-xs text-white/40 mb-2">Durée (secondes)</label>
                <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono outline-none focus:border-cyan-400/40" />
                <p className="text-xs text-white/20 mt-1">600 = 10 min · 300 = 5 min · 60 = 1 min</p>
              </div>

              <div className="flex gap-3">
                <button onClick={startEvent} disabled={loading} className="flex-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold rounded-lg px-4 py-3 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors">Lancer {pokemon.charAt(0).toUpperCase() + pokemon.slice(1)}</button>
                <button onClick={stopEvent} disabled={loading} className="flex-1 bg-red-500/20 border border-red-400/30 text-red-300 font-semibold rounded-lg px-4 py-3 hover:bg-red-500/30 disabled:opacity-40 transition-colors">Arrêter</button>
              </div>

              {status && <p className="text-sm font-mono text-cyan-300 mt-4">{status}</p>}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Statistiques</h2>
                <button onClick={fetchStats} disabled={loading} className="text-xs bg-white/5 border border-white/10 text-white/50 rounded-lg px-3 py-1.5 hover:bg-white/10 disabled:opacity-40 transition-colors">Actualiser</button>
              </div>
              {stats ? <p className="text-sm font-mono text-white/70">{stats}</p> : <p className="text-xs text-white/30">Cliquez sur actualiser</p>}
            </div>
          </>
        )}

        {/* LIVE VIEWER TAB */}
        {tab === "live" && (
          <>
            <div className="bg-white/5 border border-yellow-400/20 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-yellow-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Combats en cours ({liveBattles.length})
                </h2>
                <p className="text-[10px] text-white/30">Auto-refresh 3s</p>
              </div>

              {liveBattles.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-8">Aucun combat en cours</p>
              ) : (
                <div className="space-y-3">
                  {liveBattles.map((b) => {
                    const raikouPct = b.raikouHP && b.raikouMaxHP ? (b.raikouHP / b.raikouMaxHP) * 100 : 100;
                    const playerPct = b.currentPokemonHP && b.currentPokemonMaxHP ? (b.currentPokemonHP / b.currentPokemonMaxHP) * 100 : 100;
                    return (
                      <div key={b.id} className="bg-black/30 border border-yellow-400/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-300 font-bold">{b.pseudo}</span>
                            <span className="text-xs text-white/30">vs RAIKOU</span>
                          </div>
                          <span className="text-[10px] text-white/30 font-mono">
                            {b.pokeballsLeft !== null ? `${b.pokeballsLeft} 🔴` : ""}
                          </span>
                        </div>

                        {/* Raikou HP */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-yellow-200/60 font-bold">RAIKOU</span>
                            <span className="text-white/40 font-mono">{b.raikouHP}/{b.raikouMaxHP}</span>
                          </div>
                          <div className="w-full h-2 bg-black/50 rounded overflow-hidden">
                            <div style={{
                              width: `${raikouPct}%`,
                              height: "100%",
                              background: raikouPct > 50 ? "#22c55e" : raikouPct > 20 ? "#f59e0b" : "#ef4444",
                              transition: "width 0.5s",
                            }} />
                          </div>
                        </div>

                        {/* Player HP */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-cyan-200/60 font-bold">{b.currentPokemon?.toUpperCase() || "—"}</span>
                            <span className="text-white/40 font-mono">{b.currentPokemonHP}/{b.currentPokemonMaxHP}</span>
                          </div>
                          <div className="w-full h-2 bg-black/50 rounded overflow-hidden">
                            <div style={{
                              width: `${playerPct}%`,
                              height: "100%",
                              background: playerPct > 50 ? "#22c55e" : playerPct > 20 ? "#f59e0b" : "#ef4444",
                              transition: "width 0.5s",
                            }} />
                          </div>
                        </div>

                        {b.lastAction && (
                          <p className="text-[10px] text-white/40 italic mt-2">→ {b.lastAction}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent results */}
            {battleResults.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Résultats récents</h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {battleResults.map((r) => {
                    const statusInfo = {
                      victory: { label: "🏆 CAPTURÉ", color: "text-yellow-300" },
                      defeat: { label: "💀 DÉFAITE", color: "text-red-400" },
                      fled: { label: "💨 ENFUI", color: "text-slate-400" },
                    }[r.status] || { label: r.status, color: "text-white/40" };
                    return (
                      <div key={r.id} className="flex items-center justify-between bg-black/30 rounded px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                          <span className="text-sm text-white">{r.pseudo}</span>
                        </div>
                        <span className="text-[10px] text-white/30 font-mono">
                          {r.timestamp ? new Date(r.timestamp).toLocaleTimeString("fr-FR") : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* WINNERS TAB */}
        {tab === "winners" && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-yellow-400/80 uppercase tracking-wider">Gagnants</h2>
              <button onClick={fetchWinners} disabled={loading} className="text-xs bg-yellow-500/10 border border-yellow-400/20 text-yellow-300/70 rounded-lg px-3 py-1.5 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors">Charger</button>
            </div>
            {winners.length === 0 ? (
              <p className="text-xs text-white/30">Aucun gagnant pour le moment, ou cliquez Charger</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {winners.map((w, i) => (
                  <div key={w.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-yellow-400 font-bold text-sm">#{i + 1}</span>
                      <div>
                        <span className="text-white font-semibold">{w.pseudo}</span>
                        <span className="text-xs text-white/30 ml-2">({w.pokemon || "suicune"})</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40 font-mono">
                        {w.timestamp ? new Date(w.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                      </p>
                      <p className="text-xs text-white/20">roll: {w.roll}/10000</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}