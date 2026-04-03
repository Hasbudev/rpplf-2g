const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const EVENT_DOC = "events/current";
const DEFAULT_DURATION = 600;
const MAX_ATTEMPTS = 3;

function getInput(data) {
  return data?.data || data;
}

function verifyAdmin(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new functions.https.HttpsError("failed-precondition", "Admin password not configured.");
  }
  if (password !== adminPassword) {
    throw new functions.https.HttpsError("permission-denied", "Mot de passe incorrect.");
  }
}

exports.startEvent = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  verifyAdmin(input?.password);

  const duration = input?.durationSeconds ?? DEFAULT_DURATION;
  const pokemon = input?.pokemon ?? "suicune";

  await db.doc(EVENT_DOC).set({
    active: true,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    durationSeconds: duration,
    pokemon,
  });

  return { success: true, durationSeconds: duration, pokemon };
});

exports.stopEvent = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  verifyAdmin(input?.password);
  await db.doc(EVENT_DOC).update({ active: false });
  return { success: true };
});

exports.attemptCapture = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  const pseudo = input?.pseudo;
  const deviceId = input?.deviceId;

  if (!pseudo || typeof pseudo !== "string" || pseudo.trim().length < 2) {
    return { success: false, reason: "pseudo_required" };
  }
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) {
    return { success: false, reason: "device_id_required" };
  }

  const cleanPseudo = pseudo.trim().substring(0, 30);

  const eventSnap = await db.doc(EVENT_DOC).get();
  if (!eventSnap.exists || !eventSnap.data()?.active) {
    return { success: false, reason: "no_active_event" };
  }

  const eventData = eventSnap.data();
  const startedAt = eventData.startedAt?.toMillis?.() ?? 0;
  const duration = (eventData.durationSeconds ?? DEFAULT_DURATION) * 1000;
  const pokemon = eventData.pokemon ?? "suicune";

  if (Date.now() > startedAt + duration) {
    await db.doc(EVENT_DOC).update({ active: false });
    return { success: false, reason: "event_expired" };
  }

  const eventId = String(startedAt);
  const attemptsSnap = await db
    .collection("captures")
    .where("deviceId", "==", deviceId)
    .where("eventId", "==", eventId)
    .get();

  const attemptCount = attemptsSnap.size;

  if (attemptCount >= MAX_ATTEMPTS) {
    return { success: false, reason: "max_attempts", attemptsUsed: attemptCount, maxAttempts: MAX_ATTEMPTS };
  }

  const roll = crypto.randomInt(0, 10000);
  const success = roll < 20; // 0.2% = 20/10000
  const currentAttempt = attemptCount + 1;

  await db.collection("captures").add({
    pseudo: cleanPseudo,
    deviceId,
    eventId,
    roll,
    success,
    attemptNumber: currentAttempt,
    pokemon,
    encounterId: input?.encounterId ?? `${pokemon}_001`,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (success) {
    await db.collection("winners").add({
      pseudo: cleanPseudo,
      deviceId,
      eventId,
      roll,
      attemptNumber: currentAttempt,
      pokemon,
      encounterId: input?.encounterId ?? `${pokemon}_001`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success, roll, attemptNumber: currentAttempt, attemptsRemaining: MAX_ATTEMPTS - currentAttempt };
});

exports.getWinners = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  verifyAdmin(input?.password);

  const winnersSnap = await db
    .collection("winners")
    .orderBy("timestamp", "desc")
    .limit(100)
    .get();

  const winners = [];
  winnersSnap.forEach((doc) => {
    const d = doc.data();
    winners.push({
      id: doc.id,
      pseudo: d.pseudo,
      roll: d.roll,
      pokemon: d.pokemon ?? "suicune",
      attemptNumber: d.attemptNumber ?? "?",
      encounterId: d.encounterId,
      timestamp: d.timestamp?.toDate?.()?.toISOString?.() ?? null,
    });
  });

  return { winners };
});

exports.getCaptureStats = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  verifyAdmin(input?.password);

  const captures = await db
    .collection("captures")
    .orderBy("timestamp", "desc")
    .limit(500)
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

/* ═══════════════════════════════════════════════
   CHECK ATTEMPTS (player — called before pseudo screen)
   ═══════════════════════════════════════════════ */

exports.checkAttempts = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  const deviceId = input?.deviceId;

  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) {
    return { attemptsUsed: 0, maxAttempts: MAX_ATTEMPTS, blocked: false };
  }

  const eventSnap = await db.doc(EVENT_DOC).get();
  if (!eventSnap.exists || !eventSnap.data()?.active) {
    return { attemptsUsed: 0, maxAttempts: MAX_ATTEMPTS, blocked: false };
  }

  const eventData = eventSnap.data();
  const startedAt = eventData.startedAt?.toMillis?.() ?? 0;
  const eventId = String(startedAt);

  const attemptsSnap = await db
    .collection("captures")
    .where("deviceId", "==", deviceId)
    .where("eventId", "==", eventId)
    .get();

  const attemptsUsed = attemptsSnap.size;
  const hasWon = attemptsSnap.docs.some((doc) => doc.data().success === true);

  return {
    attemptsUsed,
    maxAttempts: MAX_ATTEMPTS,
    blocked: attemptsUsed >= MAX_ATTEMPTS || hasWon,
    hasWon,
  };
});
