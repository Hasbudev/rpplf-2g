"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  const [status, setStatus] = useState("");
  const [duration, setDuration] = useState(600);
  const [loading, setLoading] = useState(false);

  // Winners
  const [winners, setWinners] = useState<any[]>([]);
  const [stats, setStats] = useState<string>("");

  const tryAuth = async () => {
    setAuthError("");
    setLoading(true);
    try {
      // Test the password by calling getStats
      const fn = httpsCallable(functions, "getCaptureStats");
      await fn({ password });
      setAuthenticated(true);
    } catch (err: any) {
      const msg = err?.message || "Erreur";
      if (msg.includes("permission-denied") || msg.includes("incorrect")) {
        setAuthError("Mot de passe incorrect.");
      } else {
        setAuthError(msg);
      }
    }
    setLoading(false);
  };

  const startEvent = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "startEvent");
      const res = await fn({ password, durationSeconds: duration });
      setStatus(`Événement lancé ! Durée: ${(res.data as any).durationSeconds}s`);
    } catch (err: any) {
      setStatus(`Erreur: ${err.message}`);
    }
    setLoading(false);
  };

  const stopEvent = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "stopEvent");
      await fn({ password });
      setStatus("Événement arrêté.");
    } catch (err: any) {
      setStatus(`Erreur: ${err.message}`);
    }
    setLoading(false);
  };

  const fetchWinners = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "getWinners");
      const res = await fn({ password });
      setWinners((res.data as any).winners || []);
    } catch (err: any) {
      setStatus(`Erreur: ${err.message}`);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "getCaptureStats");
      const res = await fn({ password });
      const d = res.data as any;
      setStats(`${d.totalAttempts} tentatives, ${d.totalCaptures} captures (${d.captureRate})`);
    } catch (err: any) {
      setStatus(`Erreur: ${err.message}`);
    }
    setLoading(false);
  };

  /* ─── Login screen ─── */
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#050810] text-white flex items-center justify-center p-8">
        <div className="max-w-sm w-full">
          <h1
            className="text-3xl font-black mb-2 text-center"
            style={{ fontFamily: "Anybody, sans-serif" }}
          >
            ADMIN
          </h1>
          <p className="text-sm text-white/40 mb-8 text-center">
            Panneau de gestion Suicune
          </p>

          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryAuth()}
            placeholder="Mot de passe admin..."
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono outline-none focus:border-cyan-400/40 mb-4 text-center"
          />

          {authError && (
            <p className="text-red-400 text-sm text-center mb-4">{authError}</p>
          )}

          <button
            onClick={tryAuth}
            disabled={loading || !password}
            className="w-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-semibold rounded-lg px-4 py-3 hover:bg-cyan-500/30 disabled:opacity-40 transition-colors"
          >
            {loading ? "Vérification..." : "Connexion"}
          </button>
        </div>
      </div>
    );
  }

  /* ─── Admin panel ─── */
  return (
    <div className="min-h-screen bg-[#050810] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-3xl font-black mb-1"
              style={{ fontFamily: "Anybody, sans-serif" }}
            >
              ADMIN PANEL
            </h1>
            <p className="text-sm text-white/40">
              Gestion des événements Suicune
            </p>
          </div>
          <button
            onClick={() => { setAuthenticated(false); setPassword(""); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Déconnexion
          </button>
        </div>

        {/* Event controls */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
            Contrôle événement
          </h2>

          <div className="mb-4">
            <label className="block text-xs text-white/40 mb-2">
              Durée (secondes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono outline-none focus:border-cyan-400/40"
            />
            <p className="text-xs text-white/20 mt-1">
              600 = 10 min · 300 = 5 min · 60 = 1 min
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={startEvent}
              disabled={loading}
              className="flex-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold rounded-lg px-4 py-3 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
            >
              Lancer
            </button>
            <button
              onClick={stopEvent}
              disabled={loading}
              className="flex-1 bg-red-500/20 border border-red-400/30 text-red-300 font-semibold rounded-lg px-4 py-3 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
            >
              Arrêter
            </button>
          </div>

          {status && (
            <p className="text-sm font-mono text-cyan-300 mt-4">{status}</p>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
              Statistiques
            </h2>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="text-xs bg-white/5 border border-white/10 text-white/50 rounded-lg px-3 py-1.5 hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              Actualiser
            </button>
          </div>
          {stats ? (
            <p className="text-sm font-mono text-white/70">{stats}</p>
          ) : (
            <p className="text-xs text-white/30">Cliquez sur actualiser</p>
          )}
        </div>

        {/* Winners */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-yellow-400/80 uppercase tracking-wider">
              Gagnants
            </h2>
            <button
              onClick={fetchWinners}
              disabled={loading}
              className="text-xs bg-yellow-500/10 border border-yellow-400/20 text-yellow-300/70 rounded-lg px-3 py-1.5 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors"
            >
              Charger
            </button>
          </div>

          {winners.length === 0 ? (
            <p className="text-xs text-white/30">
              Aucun gagnant pour le moment, ou cliquez Charger
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {winners.map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-yellow-400 font-bold text-sm">
                      #{i + 1}
                    </span>
                    <span className="text-white font-semibold">
                      {w.pseudo}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40 font-mono">
                      {w.timestamp
                        ? new Date(w.timestamp).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "—"}
                    </p>
                    <p className="text-xs text-white/20">
                      roll: {w.roll}/10000
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-white/15 mt-8 text-center">
          Le mot de passe est stocké côté serveur Firebase uniquement.
        </p>
      </div>
    </div>
  );
}
