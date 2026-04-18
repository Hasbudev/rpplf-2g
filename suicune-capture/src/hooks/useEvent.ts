"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

/* ═══════════════════════════════════════════════
   EVENT STATE
   ═══════════════════════════════════════════════ */

export type EventPhase = "quiz" | "beasts" | "hooh";

export interface EventState {
  active: boolean;
  remaining: number;
  display: string;
  duration: number;
  startedAt: number | null;
  loading: boolean;
  pokemon: string;
  /** Boss event fields */
  eventType: "normal" | "boss_event";
  phase: EventPhase | null;
}

export function useEvent(): EventState {
  const [state, setState] = useState<EventState>({
    active: false, remaining: 0, display: "00:00", duration: 600,
    startedAt: null, loading: true, pokemon: "suicune",
    eventType: "normal", phase: null,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "events", "current"), (snap) => {
      if (!snap.exists()) {
        setState((s) => ({ ...s, active: false, remaining: 0, display: "00:00", loading: false }));
        return;
      }
      const data = snap.data();
      setState((s) => ({
        ...s,
        active: data.active === true,
        duration: data.durationSeconds ?? 600,
        startedAt: data.startedAt?.toMillis?.() ?? data.startedAt ?? null,
        pokemon: data.pokemon ?? "suicune",
        eventType: data.eventType ?? "normal",
        phase: data.phase ?? null,
        loading: false,
      }));
    }, (err) => {
      console.error("Event listener error:", err);
      setState((s) => ({ ...s, loading: false }));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!state.active || !state.startedAt) return;
    const tick = () => {
      const elapsed = (Date.now() - state.startedAt!) / 1000;
      const remaining = Math.max(0, state.duration - elapsed);
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      setState((s) => ({
        ...s, remaining, display: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
        active: remaining > 0,
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.active, state.startedAt, state.duration]);

  return state;
}

/* ═══════════════════════════════════════════════
   DEVICE ID
   ═══════════════════════════════════════════════ */

export function getDeviceId(): string {
  const KEY = "suicune_device_id";
  try {
    let id = localStorage.getItem(KEY);
    if (id && id.length >= 20) return id;
    id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 12) + "_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "dev_fallback_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
  }
}

/* ═══════════════════════════════════════════════
   ANTI-CHEAT CHECK
   ═══════════════════════════════════════════════ */

export interface AttemptCheck {
  blocked: boolean; hasWon: boolean; attemptsUsed: number; loading: boolean;
}

export function useCheckAttempts(eventActive: boolean): AttemptCheck {
  const [state, setState] = useState<AttemptCheck>({ blocked: false, hasWon: false, attemptsUsed: 0, loading: true });
  useEffect(() => {
    if (!eventActive) { setState({ blocked: false, hasWon: false, attemptsUsed: 0, loading: false }); return; }
    const check = async () => {
      try {
        const fn = httpsCallable(functions, "checkAttempts");
        const res = await fn({ deviceId: getDeviceId() });
        const data = res.data as any;
        setState({ blocked: Boolean(data?.blocked), hasWon: Boolean(data?.hasWon), attemptsUsed: data?.attemptsUsed ?? 0, loading: false });
      } catch (err) { console.error("Check attempts error:", err); setState((s) => ({ ...s, loading: false })); }
    };
    check();
  }, [eventActive]);
  return state;
}

/* ═══════════════════════════════════════════════
   CAPTURE (3D modes)
   ═══════════════════════════════════════════════ */

export interface CaptureResult {
  success: boolean; attemptNumber?: number; attemptsRemaining?: number; reason?: string;
}

export function useCapture() {
  const [busy, setBusy] = useState(false);
  const attempt = useCallback(async (pseudo: string, pokemon: string): Promise<CaptureResult> => {
    if (busy) return { success: false, reason: "busy" };
    setBusy(true);
    try {
      const fn = httpsCallable(functions, "attemptCapture");
      const res = await fn({ encounterId: `${pokemon}_001`, pseudo, deviceId: getDeviceId() });
      const data = res.data as any;
      return { success: Boolean(data?.success), attemptNumber: data?.attemptNumber, attemptsRemaining: data?.attemptsRemaining, reason: data?.reason };
    } catch (err) { console.error("Capture error:", err); return { success: false, reason: "error" }; }
    finally { setBusy(false); }
  }, [busy]);
  return { attempt, busy };
}

/* ═══════════════════════════════════════════════
   LIVE BATTLE TRACKING
   ═══════════════════════════════════════════════ */

export interface LiveBattleUpdate {
  pseudo: string;
  pokemon: string;
  currentPokemon?: string | null;
  currentPokemonHP?: number;
  currentPokemonMaxHP?: number;
  raikouHP?: number;
  raikouMaxHP?: number;
  pokeballsLeft?: number;
  lastAction?: string;
  status?: "in_battle" | "victory" | "defeat" | "fled";
  /** Boss event extras */
  battlePhase?: string;       // "beasts" | "hooh"
  currentBeast?: string;      // "raikou" | "entei" | "suicune"
  bossPhase?: string;         // "sacred" | "rage" | "divine"
  beastsDefeated?: number;
  log?: string[];             // last N log lines for spectator
}

export async function updateLiveBattle(update: LiveBattleUpdate): Promise<void> {
  try {
    const fn = httpsCallable(functions, "updateLiveBattle");
    await fn({ ...update, deviceId: getDeviceId() });
  } catch (err) { console.error("Live battle update error:", err); }
}

/* ═══════════════════════════════════════════════
   BOSS EVENT — Quiz & Progress
   ═══════════════════════════════════════════════ */

export async function submitQuizResult(pseudo: string, score: number, total: number, passed: boolean): Promise<void> {
  try {
    const fn = httpsCallable(functions, "submitQuizResult");
    await fn({ pseudo, deviceId: getDeviceId(), score, total, passed });
  } catch (err) { console.error("Quiz submit error:", err); }
}

export async function submitBeastsResult(pseudo: string, defeated: number, passed: boolean): Promise<void> {
  try {
    const fn = httpsCallable(functions, "submitBeastsResult");
    await fn({ pseudo, deviceId: getDeviceId(), defeated, passed });
  } catch (err) { console.error("Beasts result error:", err); }
}

export interface PlayerProgress {
  quizPassed: boolean;
  quizScore: number;
  beastsPassed: boolean;
  beastsDefeated: number;
  loading: boolean;
}

export function usePlayerProgress(eventActive: boolean, pseudo: string): PlayerProgress {
  const [state, setState] = useState<PlayerProgress>({
    quizPassed: false, quizScore: 0, beastsPassed: false, beastsDefeated: 0, loading: true,
  });

  useEffect(() => {
    if (!eventActive || !pseudo) { setState((s) => ({ ...s, loading: false })); return; }
    const deviceId = getDeviceId();
    const unsub = onSnapshot(doc(db, "eventProgress", deviceId), (snap) => {
      if (!snap.exists()) { setState({ quizPassed: false, quizScore: 0, beastsPassed: false, beastsDefeated: 0, loading: false }); return; }
      const d = snap.data();
      setState({
        quizPassed: Boolean(d.quizPassed),
        quizScore: d.quizScore ?? 0,
        beastsPassed: Boolean(d.beastsPassed),
        beastsDefeated: d.beastsDefeated ?? 0,
        loading: false,
      });
    });
    return unsub;
  }, [eventActive, pseudo]);

  return state;
}
