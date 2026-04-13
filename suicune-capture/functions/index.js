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

  // Clear previous live battles when starting new event
  const liveBattlesSnap = await db.collection("liveBattles").get();
  const batch = db.batch();
  liveBattlesSnap.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

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
  const success = roll < 20;
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

/* ═══════════════════════════════════════════════
   LIVE BATTLES TRACKING (for admin live viewer)
   ═══════════════════════════════════════════════ */

// Player calls this to update their live battle state
exports.updateLiveBattle = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  const deviceId = input?.deviceId;
  const pseudo = input?.pseudo;
  const status = input?.status; // "in_battle", "victory", "defeat", "fled"

  if (!deviceId || !pseudo) {
    return { success: false };
  }

  const docRef = db.collection("liveBattles").doc(deviceId);

  if (status === "victory" || status === "defeat" || status === "fled") {
    // End of battle — record result and remove from live
    await db.collection("battleResults").add({
      pseudo,
      status,
      pokemon: input?.pokemon || "raikou",
      currentPokemon: input?.currentPokemon || null,
      raikouHP: input?.raikouHP ?? null,
      raikouMaxHP: input?.raikouMaxHP ?? null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (status === "victory") {
      // Also add to winners collection so it shows in the winners list
      const eventSnap = await db.doc(EVENT_DOC).get();
      const startedAt = eventSnap.data()?.startedAt?.toMillis?.() ?? 0;
      await db.collection("winners").add({
        pseudo,
        deviceId,
        eventId: String(startedAt),
        roll: 0,
        attemptNumber: 1,
        pokemon: input?.pokemon || "raikou",
        encounterId: `${input?.pokemon || "raikou"}_battle`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await docRef.delete().catch(() => {});
    return { success: true };
  }

  // Update live battle state
  await docRef.set({
    pseudo,
    deviceId,
    pokemon: input?.pokemon || "raikou",
    currentPokemon: input?.currentPokemon || null,
    currentPokemonHP: input?.currentPokemonHP ?? null,
    currentPokemonMaxHP: input?.currentPokemonMaxHP ?? null,
    raikouHP: input?.raikouHP ?? null,
    raikouMaxHP: input?.raikouMaxHP ?? null,
    pokeballsLeft: input?.pokeballsLeft ?? null,
    lastAction: input?.lastAction || "",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

// Admin calls this to fetch all live battles
exports.getLiveBattles = functions.https.onCall(async (data, context) => {
  const input = getInput(data);
  verifyAdmin(input?.password);

  const snap = await db.collection("liveBattles").orderBy("updatedAt", "desc").get();
  const battles = [];
  const now = Date.now();

  snap.forEach((doc) => {
    const d = doc.data();
    const updatedAt = d.updatedAt?.toMillis?.() ?? 0;
    // Only show battles updated in the last 60 seconds (active)
    if (now - updatedAt < 60000) {
      battles.push({
        id: doc.id,
        pseudo: d.pseudo,
        pokemon: d.pokemon,
        currentPokemon: d.currentPokemon,
        currentPokemonHP: d.currentPokemonHP,
        currentPokemonMaxHP: d.currentPokemonMaxHP,
        raikouHP: d.raikouHP,
        raikouMaxHP: d.raikouMaxHP,
        pokeballsLeft: d.pokeballsLeft,
        lastAction: d.lastAction,
        updatedAt,
      });
    }
  });

  // Also fetch recent battle results (last 20)
  const resultsSnap = await db.collection("battleResults")
    .orderBy("timestamp", "desc")
    .limit(20)
    .get();

  const results = [];
  resultsSnap.forEach((doc) => {
    const d = doc.data();
    results.push({
      id: doc.id,
      pseudo: d.pseudo,
      status: d.status,
      pokemon: d.pokemon,
      currentPokemon: d.currentPokemon,
      raikouHP: d.raikouHP,
      raikouMaxHP: d.raikouMaxHP,
      timestamp: d.timestamp?.toDate?.()?.toISOString?.() ?? null,
    });
  });

  return { battles, results };
});