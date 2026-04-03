"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

export interface EventState {
  active: boolean;
  remaining: number;
  display: string;
  duration: number;
  startedAt: number | null;
  loading: boolean;
  pokemon: string;
}

export function useEvent(): EventState {
  const [state, setState] = useState<EventState>({
    active: false,
    remaining: 0,
    display: "00:00",
    duration: 600,
    startedAt: null,
    loading: true,
    pokemon: "suicune",
  });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "events", "current"),
      (snap) => {
        if (!snap.exists()) {
          setState((s) => ({ ...s, active: false, remaining: 0, display: "00:00", loading: false }));
          return;
        }

        const data = snap.data();
        const active = data.active === true;
        const durationSeconds = data.durationSeconds ?? 600;
        const startedAt = data.startedAt?.toMillis?.() ?? data.startedAt ?? null;
        const pokemon = data.pokemon ?? "suicune";

        setState((s) => ({
          ...s,
          active,
          duration: durationSeconds,
          startedAt,
          pokemon,
          loading: false,
        }));
      },
      (err) => {
        console.error("Event listener error:", err);
        setState((s) => ({ ...s, loading: false }));
      }
    );

    return unsub;
  }, []);

  useEffect(() => {
    if (!state.active || !state.startedAt) return;

    const tick = () => {
      const elapsed = (Date.now() - state.startedAt!) / 1000;
      const remaining = Math.max(0, state.duration - elapsed);

      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      setState((s) => ({
        ...s,
        remaining,
        display,
        active: remaining > 0,
      }));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.active, state.startedAt, state.duration]);

  return state;
}

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

export interface AttemptCheck {
  blocked: boolean;
  hasWon: boolean;
  attemptsUsed: number;
  loading: boolean;
}

export function useCheckAttempts(eventActive: boolean): AttemptCheck {
  const [state, setState] = useState<AttemptCheck>({
    blocked: false,
    hasWon: false,
    attemptsUsed: 0,
    loading: true,
  });

  useEffect(() => {
    if (!eventActive) {
      setState({ blocked: false, hasWon: false, attemptsUsed: 0, loading: false });
      return;
    }

    const check = async () => {
      try {
        const fn = httpsCallable(functions, "checkAttempts");
        const res = await fn({ deviceId: getDeviceId() });
        const data = res.data as any;
        setState({
          blocked: Boolean(data?.blocked),
          hasWon: Boolean(data?.hasWon),
          attemptsUsed: data?.attemptsUsed ?? 0,
          loading: false,
        });
      } catch (err) {
        console.error("Check attempts error:", err);
        setState((s) => ({ ...s, loading: false }));
      }
    };

    check();
  }, [eventActive]);

  return state;
}

export interface CaptureResult {
  success: boolean;
  attemptNumber?: number;
  attemptsRemaining?: number;
  reason?: string;
}

export function useCapture() {
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(async (pseudo: string, pokemon: string): Promise<CaptureResult> => {
    if (busy) return { success: false, reason: "busy" };
    setBusy(true);
    try {
      const fn = httpsCallable(functions, "attemptCapture");
      const res = await fn({
        encounterId: `${pokemon}_001`,
        pseudo,
        deviceId: getDeviceId(),
      });
      const data = res.data as any;
      return {
        success: Boolean(data?.success),
        attemptNumber: data?.attemptNumber,
        attemptsRemaining: data?.attemptsRemaining,
        reason: data?.reason,
      };
    } catch (err) {
      console.error("Capture error:", err);
      return { success: false, reason: "error" };
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { attempt, busy };
}
