"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";

/**
 * Admin page to manage Suicune encounter events.
 * Access at /admin — protect this route in production!
 *
 * Add auth gating: only allow specific UIDs or use Firebase Auth
 * custom claims to restrict access.
 */
export default function AdminPage() {
  const [status, setStatus] = useState("");
  const [duration, setDuration] = useState(600);
  const [loading, setLoading] = useState(false);

  const startEvent = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "startEvent");
      const res = await fn({ durationSeconds: duration });
      setStatus(`Event started! Duration: ${(res.data as any).durationSeconds}s`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const stopEvent = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "stopEvent");
      await fn({});
      setStatus("Event stopped.");
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const getStats = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, "getCaptureStats");
      const res = await fn({});
      const data = res.data as any;
      setStatus(
        `Stats: ${data.totalAttempts} attempts, ${data.totalCaptures} captures (${data.captureRate})`
      );
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050810] text-white p-8">
      <div className="max-w-lg mx-auto">
        <h1
          className="text-3xl font-black mb-2"
          style={{ fontFamily: "Anybody, sans-serif" }}
        >
          ADMIN PANEL
        </h1>
        <p className="text-sm text-white/40 mb-8">
          Gestion des événements Suicune
        </p>

        {/* Duration control */}
        <div className="mb-6">
          <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">
            Durée de l'événement (secondes)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono outline-none focus:border-cyan-400/40"
          />
          <p className="text-xs text-white/30 mt-1">
            600 = 10 min, 300 = 5 min, 60 = 1 min
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={startEvent}
            disabled={loading}
            className="flex-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-semibold rounded-lg px-4 py-3 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
          >
            Lancer l'événement
          </button>
          <button
            onClick={stopEvent}
            disabled={loading}
            className="flex-1 bg-red-500/20 border border-red-400/30 text-red-300 font-semibold rounded-lg px-4 py-3 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
          >
            Arrêter
          </button>
        </div>

        <button
          onClick={getStats}
          disabled={loading}
          className="w-full bg-white/5 border border-white/10 text-white/70 font-medium rounded-lg px-4 py-3 hover:bg-white/10 disabled:opacity-40 transition-colors mb-6"
        >
          Voir les statistiques
        </button>

        {/* Status */}
        {status && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="text-sm font-mono text-cyan-300">{status}</p>
          </div>
        )}

        {/* Notes */}
        <div className="mt-8 text-xs text-white/20 leading-relaxed">
          <p className="mb-2">
            <strong className="text-white/30">Note :</strong> En cas de problemes contactez Hasbi
          </p>
        </div>
      </div>
    </div>
  );
}
