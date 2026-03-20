"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

export interface EventState {
  /** Is there an active event right now? */
  active: boolean;
  /** Seconds remaining (0 when inactive) */
  remaining: number;
  /** Formatted MM:SS string */
  display: string;
  /** Total duration in seconds */
  duration: number;
  /** When the event started (epoch ms) */
  startedAt: number | null;
  /** Loading state */
  loading: boolean;
}

const EVENT_DOC = "events/current";

/**
 * Real-time listener for the global event timer.
 *
 * Firestore doc structure at `events/current`:
 * {
 *   active: boolean,
 *   startedAt: Timestamp,
 *   durationSeconds: number  (default 600 = 10 min)
 * }
 */
export function useEvent(): EventState {
  const [state, setState] = useState<EventState>({
    active: false,
    remaining: 0,
    display: "00:00",
    duration: 600,
    startedAt: null,
    loading: true,
  });

  useEffect(() => {
    // Listen to the event document in real time
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

        setState((s) => ({
          ...s,
          active,
          duration: durationSeconds,
          startedAt,
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

  // Tick the countdown every second
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

/**
 * Hook to call the attemptCapture cloud function.
 */
export function useCapture() {
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const fn = httpsCallable(functions, "attemptCapture");
      const res = await fn({ encounterId: "suicune_001" });
      return Boolean((res.data as any)?.success);
    } catch (err) {
      console.error("Capture error:", err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { attempt, busy };
}
