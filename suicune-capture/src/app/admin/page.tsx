"use client";
import { useState, useEffect, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, collection, onSnapshot } from "firebase/firestore";
import { functions, db } from "../../lib/firebase";
import { SpectatorView } from "../../components/SpectatorView";
import { PlayerProgressDashboard } from "../../components/PlayerProgressDashboard";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<"control"|"live"|"progress"|"winners">("control");

  const [eventActive, setEventActive] = useState(false);
  const [eventType, setEventType] = useState("normal");
  const [eventPhase, setEventPhase] = useState<string|null>(null);
  const [eventPokemon, setEventPokemon] = useState("suicune");

  const [liveBattles, setLiveBattles] = useState<any[]>([]);
  const [spectatingId, setSpectatingId] = useState<string|null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const [autoAdvance, setAutoAdvance] = useState(true);
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", "current"), snap => {
      if (!snap.exists()) { setEventActive(false); return; }
      const d = snap.data();
      setEventActive(d.active === true);
      setEventType(d.eventType || "normal");
      setEventPhase(d.phase || null);
      setEventPokemon(d.pokemon || "suicune");
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(collection(db, "liveBattles"), snap => {
      const b: any[] = []; const now = Date.now();
      snap.forEach(d => { const data = d.data(); const u = data.updatedAt?.toMillis?.()||0; if (now-u<120000) b.push({ id: d.id, ...data, updatedAt: u }); });
      b.sort((a,b) => b.updatedAt-a.updatedAt);
      setLiveBattles(b);
    });
    return unsub;
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(collection(db, "eventProgress"), snap => {
      const p: any[] = [];
      snap.forEach(d => p.push({ id: d.id, ...d.data() }));
      p.sort((a,b) => (b.quizScore||0)-(a.quizScore||0));
      setProgress(p);
    });
    return unsub;
  }, [authed]);

  const callFn = useCallback(async (name: string, data: any) => {
    setBusy(true);
    try { const fn = httpsCallable(functions, name); const res = await fn({ ...data, password }); return (res.data as any); }
    catch (err: any) { setAuthError(err.message||"Erreur"); return null; }
    finally { setBusy(false); }
  }, [password]);

  const login = async () => { const res = await callFn("getWinners", {}); if (res) { setAuthed(true); setAuthError(""); setWinners(res.winners||[]); } };
  const startBossEvent = async () => { await callFn("startEvent", { durationSeconds: duration*60, pokemon: "ho-oh", eventType: "boss_event", phase: "quiz", autoAdvance }); };
  const startNormalEvent = async (pokemon: string) => { await callFn("startEvent", { durationSeconds: duration*60, pokemon, eventType: "normal" }); };
  const advancePhase = async (phase: string) => { await callFn("setEventPhase", { phase }); };
  const stopEvent = async () => { await callFn("stopEvent", {}); };
  const refreshWinners = async () => {
    const r = await callFn("getWinners", {}); if (r) setWinners(r.winners||[]);
    const s = await callFn("getCaptureStats", {}); if (s) setStats(s);
  };

  const quizPassed = progress.filter((p: any) => p.quizPassed).length;
  const beastsPassed = progress.filter((p: any) => p.beastsPassed).length;
  const totalPlayers = progress.length;

  if (!authed) return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#0d1117] p-6" style={{ fontFamily: "system-ui" }}>
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 max-w-sm w-full">
        <h1 className="text-lg font-bold text-white mb-4">🔒 Admin RPPLF</h1>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter"&&login()} placeholder="Mot de passe" autoFocus
          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm mb-3 outline-none focus:border-blue-500" />
        {authError && <p className="text-red-400 text-xs mb-2">{authError}</p>}
        <button onClick={login} disabled={busy} className="w-full bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-semibold py-2 rounded disabled:opacity-50">{busy?"…":"Connexion"}</button>
      </div>
    </div>
  );

  return (
    <div className="h-dvh w-full flex bg-[#0d1117] text-[#c9d1d9] overflow-hidden" style={{ fontFamily: "system-ui", fontSize: "13px" }}>

      {/* ── LEFT PANEL ── */}
      <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-[#30363d] overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-[#30363d] bg-[#161b22]">
          {(["control","live","progress","winners"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t==="winners") refreshWinners(); }}
              className="flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: tab===t?"#58a6ff":"#8b949e", borderBottom: tab===t?"2px solid #58a6ff":"2px solid transparent", background: tab===t?"#0d1117":"transparent" }}>
              {t==="control" ? "⚙️ Contrôle"
               : t==="live"  ? `🎮 Live (${liveBattles.length})`
               : t==="progress" ? `📊 Joueurs (${totalPlayers})`
               : "🏆 Gagnants"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">

          {/* ─── CONTRÔLE ─── */}
          {tab === "control" && (
            <div className="space-y-3">
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#8b949e]">ÉTAT</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${eventActive?"bg-green-900/30 text-green-400":"bg-red-900/20 text-red-400"}`}>
                    {eventActive?"EN COURS":"INACTIF"}
                  </span>
                </div>
                {eventActive && (
                  <div className="text-xs text-[#8b949e] space-y-1">
                    <p>Pokémon : <strong className="text-white">{eventPokemon}</strong> · Type : <strong className="text-white">{eventType}</strong></p>
                    {eventPhase && <p>Phase : <strong className="text-amber-400">{eventPhase.toUpperCase()}</strong></p>}
                  </div>
                )}
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
                <h3 className="text-xs font-bold text-[#8b949e] mb-2">⏱ DURÉE</h3>
                <div className="flex gap-1">
                  {[15,30,45,60,90,120].map(m => (
                    <button key={m} onClick={() => setDuration(m)} className="flex-1 text-[10px] font-bold py-1.5 rounded border transition-colors"
                      style={{ borderColor: duration===m?"#58a6ff":"#30363d", background: duration===m?"#58a6ff20":"transparent", color: duration===m?"#58a6ff":"#8b949e" }}>
                      {m}min
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
                <h3 className="text-xs font-bold text-amber-400 mb-2">🔥 BOSS EVENT (Ho-Oh)</h3>
                {!eventActive ? (
                  <>
                    <div className="flex items-center justify-between mb-3 bg-[#0d1117] rounded p-2">
                      <span className="text-[10px] text-[#8b949e]">Phases :</span>
                      <div className="flex gap-1">
                        <button onClick={() => setAutoAdvance(true)} className="text-[10px] font-bold px-2 py-1 rounded border"
                          style={{ borderColor: autoAdvance?"#22c55e":"#30363d", background: autoAdvance?"#22c55e20":"transparent", color: autoAdvance?"#22c55e":"#8b949e" }}>
                          🔄 Auto
                        </button>
                        <button onClick={() => setAutoAdvance(false)} className="text-[10px] font-bold px-2 py-1 rounded border"
                          style={{ borderColor: !autoAdvance?"#f59e0b":"#30363d", background: !autoAdvance?"#f59e0b20":"transparent", color: !autoAdvance?"#f59e0b":"#8b949e" }}>
                          ✋ Manuel
                        </button>
                      </div>
                    </div>
                    <p className="text-[9px] text-[#484f58] mb-2">
                      {autoAdvance ? "Chaque joueur avance automatiquement dès qu'il réussit une étape." : "Tu contrôles quand tout le monde passe à l'étape suivante."}
                    </p>
                    <button onClick={startBossEvent} disabled={busy}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2 rounded disabled:opacity-50">
                      Lancer Boss Event ({duration}min)
                    </button>
                  </>
                ) : eventType === "boss_event" ? (
                  <div className="space-y-2">
                    <div className="bg-[#0d1117] rounded p-2 text-[10px] space-y-1">
                      <div className="flex justify-between"><span className="text-[#8b949e]">Quiz réussi</span><span className="text-green-400 font-bold">{quizPassed} / {totalPlayers}</span></div>
                      <div className="h-1.5 bg-[#30363d] rounded-full overflow-hidden"><div style={{ width: `${totalPlayers>0?(quizPassed/totalPlayers)*100:0}%`, height:"100%", background:"#22c55e", transition:"width .5s" }}/></div>
                      <div className="flex justify-between mt-1"><span className="text-[#8b949e]">3v3 réussi</span><span className="text-green-400 font-bold">{beastsPassed} / {quizPassed||1}</span></div>
                      <div className="h-1.5 bg-[#30363d] rounded-full overflow-hidden"><div style={{ width: `${quizPassed>0?(beastsPassed/quizPassed)*100:0}%`, height:"100%", background:"#f59e0b", transition:"width .5s" }}/></div>
                    </div>
                    <p className="text-[10px] text-[#8b949e]">Forcer la phase :</p>
                    <div className="flex gap-1">
                      {(["quiz","beasts","hooh"] as const).map(p => (
                        <button key={p} onClick={() => advancePhase(p)} disabled={busy||eventPhase===p}
                          className="flex-1 text-[10px] font-bold py-1.5 rounded border transition-colors"
                          style={{ borderColor: eventPhase===p?"#f59e0b":"#30363d", background: eventPhase===p?"#f59e0b20":"transparent", color: eventPhase===p?"#f59e0b":"#8b949e" }}>
                          {p==="quiz"?"📝 Quiz":p==="beasts"?"⚔️ 3v3":"🔥 Ho-Oh"}
                        </button>
                      ))}
                    </div>
                    <button onClick={stopEvent} disabled={busy}
                      className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-bold py-1.5 rounded border border-red-800/30">
                      Arrêter
                    </button>
                  </div>
                ) : <p className="text-xs text-[#8b949e]">Un event normal est en cours.</p>}
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
                <h3 className="text-xs font-bold text-[#8b949e] mb-2">EVENTS NORMAUX</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {[{n:"suicune",l:"Suicune",c:"#38bdf8"},{n:"entei",l:"Entei",c:"#ef4444"},{n:"raikou",l:"Raikou",c:"#fbbf24"}].map(p => (
                    <button key={p.n} onClick={() => startNormalEvent(p.n)} disabled={busy||eventActive}
                      className="text-[10px] font-bold py-2 rounded border border-[#30363d] hover:border-[#484f58] disabled:opacity-30" style={{ color: p.c }}>
                      {p.l}
                    </button>
                  ))}
                </div>
                {eventActive && eventType==="normal" && (
                  <button onClick={stopEvent} disabled={busy} className="w-full mt-2 bg-red-900/30 text-red-400 text-xs font-bold py-1.5 rounded border border-red-800/30">Stop</button>
                )}
              </div>
            </div>
          )}

          {/* ─── LIVE ─── */}
          {tab === "live" && (
            <div className="space-y-2">
              {liveBattles.length === 0
                ? <div className="text-center text-[#30363d] py-8">
                    <p className="text-2xl mb-2">🎮</p>
                    <p className="text-xs">Aucun combat en cours</p>
                    <p className="text-[9px] text-[#21262d] mt-1">Les combats apparaissent en temps réel</p>
                  </div>
                : liveBattles.map(b => {
                    const hpPct = b.raikouMaxHP>0 ? Math.round((b.raikouHP/b.raikouMaxHP)*100) : 0;
                    const w = spectatingId === b.id;
                    return (
                      <button key={b.id} onClick={() => setSpectatingId(w ? null : b.id)}
                        className="w-full text-left bg-[#161b22] border rounded-lg p-3 hover:border-[#484f58]"
                        style={{ borderColor: w?"#58a6ff":"#30363d" }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                            <span className="text-xs font-bold text-white">{b.pseudo}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: b.battlePhase==="hooh"?"#f59e0b20":b.battlePhase==="beasts"?"#38bdf820":"#8b949e20", color: b.battlePhase==="hooh"?"#f59e0b":b.battlePhase==="beasts"?"#38bdf8":"#8b949e" }}>
                            {b.battlePhase==="hooh" ? "Ho-Oh" : b.battlePhase==="beasts" ? (b.currentBeast||"3v3") : b.pokemon}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#8b949e]">
                          vs {b.currentPokemon||"?"} · Boss: <strong style={{ color: hpPct>50?"#4ade80":hpPct>20?"#fbbf24":"#ef4444" }}>{hpPct}%</strong>
                        </div>
                        <div className="text-[9px] text-[#484f58] mt-1 truncate italic">{b.lastAction}</div>
                        {w && <div className="mt-1 text-[9px] text-[#58a6ff] font-bold">👁️ Spectating → panneau droit</div>}
                      </button>
                    );
                  })}
            </div>
          )}

          {/* ─── JOUEURS — Kanban par phase (temps réel) ─── */}
          {tab === "progress" && (
            <PlayerProgressDashboard />
          )}

          {/* ─── GAGNANTS ─── */}
          {tab === "winners" && (
            <div className="space-y-2">
              <button onClick={refreshWinners} disabled={busy}
                className="w-full bg-[#161b22] border border-[#30363d] text-[#58a6ff] text-[10px] font-bold py-1.5 rounded hover:bg-[#1c2129] disabled:opacity-50">
                🔄 Rafraîchir
              </button>
              {stats && (
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-[11px] text-[#8b949e]">
                  <p>Tentatives: <strong className="text-white">{stats.totalAttempts}</strong> · Captures: <strong className="text-green-400">{stats.totalCaptures}</strong> · Taux: <strong className="text-amber-400">{stats.captureRate}</strong></p>
                </div>
              )}
              {winners.map(w => (
                <div key={w.id} className="bg-[#161b22] border border-[#30363d] rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">🏆 {w.pseudo}</span>
                    <span className="text-[10px] text-[#8b949e]">{w.pokemon}</span>
                  </div>
                  <div className="text-[9px] text-[#484f58] mt-0.5">{w.timestamp ? new Date(w.timestamp).toLocaleString("fr-FR") : "—"}</div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ── SPECTATEUR (panneau droit) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {spectatingId
          ? <SpectatorView deviceId={spectatingId} onClose={() => setSpectatingId(null)} />
          : <div className="flex-1 flex items-center justify-center bg-[#0d1117] text-[#30363d]">
              <div className="text-center">
                <p className="text-4xl mb-4">👁️</p>
                <p className="text-sm font-semibold">Spectateur Showdown</p>
                <p className="text-xs mt-1">Clique sur un combat dans l'onglet Live</p>
              </div>
            </div>
        }
      </div>
    </div>
  );
}