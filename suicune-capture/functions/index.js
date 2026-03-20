const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

/* ═══════════════════════════════════════════════
   EVENT MANAGEMENT
   ═══════════════════════════════════════════════

   Firestore doc: events/current
   {
     active: boolean,
     startedAt: Timestamp,
     durationSeconds: number   (default 600 = 10 min)
   }
*/

const EVENT_DOC = "events/current";
const DEFAULT_DURATION = 600; // 10 minutes

/**
 * Start a new event. Call this manually or from an admin panel.
 * Only admins should call this (add auth check for production).
 *
 * @param {Object} data
 * @param {number} [data.durationSeconds=600] - Event duration in seconds
 */
exports.startEvent = functions.https.onCall(async (data, context) => {
  // TODO: Add auth check for admin-only access
  // if (!context.auth || !isAdmin(context.auth.uid)) throw ...

  const duration = data?.durationSeconds ?? DEFAULT_DURATION;

  await db.doc(EVENT_DOC).set({
    active: true,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    durationSeconds: duration,
  });

  // Schedule auto-close after duration
  // (Firestore TTL or a scheduled function can also handle this)
  setTimeout(async () => {
    try {
      const snap = await db.doc(EVENT_DOC).get();
      if (snap.exists && snap.data()?.active) {
        await db.doc(EVENT_DOC).update({ active: false });
        console.log("Event auto-closed after timeout.");
      }
    } catch (err) {
      console.error("Auto-close error:", err);
    }
  }, duration * 1000);

  return { success: true, durationSeconds: duration };
});

/**
 * Stop the current event immediately.
 */
exports.stopEvent = functions.https.onCall(async (data, context) => {
  // TODO: Add auth check
  await db.doc(EVENT_DOC).update({ active: false });
  return { success: true };
});

/**
 * Attempt to capture Suicune.
 * 0.5% chance (50 out of 10000).
 * Only works during an active event.
 */
exports.attemptCapture = functions.https.onCall(async (data, context) => {
  // Check if event is active
  const eventSnap = await db.doc(EVENT_DOC).get();

  if (!eventSnap.exists || !eventSnap.data()?.active) {
    return { success: false, reason: "no_active_event" };
  }

  // Check if event has expired (belt-and-suspenders with client timer)
  const eventData = eventSnap.data();
  const startedAt = eventData.startedAt?.toMillis?.() ?? 0;
  const duration = (eventData.durationSeconds ?? DEFAULT_DURATION) * 1000;
  const now = Date.now();

  if (now > startedAt + duration) {
    // Auto-close expired event
    await db.doc(EVENT_DOC).update({ active: false });
    return { success: false, reason: "event_expired" };
  }

  // Secure RNG: 0.5% = 50 / 10000
  const roll = crypto.randomInt(0, 10000);
  const success = roll < 50;

  // Log the attempt
  await db.collection("captures").add({
    roll,
    success,
    encounterId: data?.encounterId ?? "unknown",
    userId: context.auth?.uid ?? "anonymous",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success, roll };
});

/**
 * Scheduled function: Auto-close expired events every minute.
 * Deploy with: firebase deploy --only functions
 *
 * This acts as a safety net in case the setTimeout in startEvent
 * doesn't fire (e.g., cold start issues).
 */
/**
 * Get capture statistics (optional, for an admin dashboard).
 */
exports.getCaptureStats = functions.https.onCall(async (data, context) => {
  const captures = await db
    .collection("captures")
    .orderBy("timestamp", "desc")
    .limit(100)
    .get();

  let total = 0;
  let successes = 0;

  captures.forEach((doc) => {
    total++;
    if (doc.data().success) successes++;
  });

  return {
    totalAttempts: total,
    totalCaptures: successes,
    captureRate: total > 0 ? ((successes / total) * 100).toFixed(2) + "%" : "0%",
  };
});
