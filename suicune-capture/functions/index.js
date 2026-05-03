const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const EVENT_DOC = "events/current";
const DEFAULT_DURATION = 600;
const MAX_ATTEMPTS = 3;

function getInput(data) { return data?.data || data; }

function verifyAdmin(password) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new functions.https.HttpsError("failed-precondition", "Admin password not configured.");
  if (password !== adminPassword) throw new functions.https.HttpsError("permission-denied", "Mot de passe incorrect.");
}

/* ═══════════════════════════════════════════════
   EVENT MANAGEMENT
   ═══════════════════════════════════════════════ */

exports.startEvent = functions.https.onCall(async (data) => {
  const input = getInput(data);
  verifyAdmin(input?.password);
  const duration = input?.durationSeconds ?? DEFAULT_DURATION;
  const pokemon = input?.pokemon ?? "suicune";
  const eventType = input?.eventType ?? "normal";
  const phase = input?.phase ?? null;
  const autoAdvance = input?.autoAdvance !== false;

  await db.doc(EVENT_DOC).set({
    active: true,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    durationSeconds: duration,
    pokemon,
    eventType,
    phase,
    autoAdvance,
  });

  // Clear previous live battles
  const liveBattlesSnap = await db.collection("liveBattles").get();
  const batch = db.batch();
  liveBattlesSnap.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // For boss events, clear progress
  if (eventType === "boss_event") {
    const progressSnap = await db.collection("eventProgress").get();
    const batch2 = db.batch();
    progressSnap.forEach((doc) => batch2.delete(doc.ref));
    await batch2.commit();
  }

  return { success: true, durationSeconds: duration, pokemon, eventType, phase };
});

// Admin advances boss event phase
exports.setEventPhase = functions.https.onCall(async (data) => {
  const input = getInput(data);
  verifyAdmin(input?.password);
  const phase = input?.phase; // "quiz" | "beasts" | "hooh"
  if (!["quiz", "beasts", "hooh"].includes(phase)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid phase.");
  }
  await db.doc(EVENT_DOC).update({ phase });
  return { success: true, phase };
});

exports.stopEvent = functions.https.onCall(async (data) => {
  const input = getInput(data);
  verifyAdmin(input?.password);
  await db.doc(EVENT_DOC).update({ active: false });
  return { success: true };
});

/* ═══════════════════════════════════════════════
   3D CAPTURE (Suicune/Entei)
   ═══════════════════════════════════════════════ */

exports.attemptCapture = functions.https.onCall(async (data) => {
  const input = getInput(data);
  const pseudo = input?.pseudo;
  const deviceId = input?.deviceId;
  if (!pseudo || typeof pseudo !== "string" || pseudo.trim().length < 2) return { success: false, reason: "pseudo_required" };
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) return { success: false, reason: "device_id_required" };
  const cleanPseudo = pseudo.trim().substring(0, 30);

  const eventSnap = await db.doc(EVENT_DOC).get();
  if (!eventSnap.exists || !eventSnap.data()?.active) return { success: false, reason: "no_active_event" };
  const eventData = eventSnap.data();
  const startedAt = eventData.startedAt?.toMillis?.() ?? 0;
  const duration = (eventData.durationSeconds ?? DEFAULT_DURATION) * 1000;
  const pokemon = eventData.pokemon ?? "suicune";
  if (Date.now() > startedAt + duration) {
    await db.doc(EVENT_DOC).update({ active: false });
    return { success: false, reason: "event_expired" };
  }
  const eventId = String(startedAt);
  const attemptsSnap = await db.collection("captures").where("deviceId", "==", deviceId).where("eventId", "==", eventId).get();
  const attemptCount = attemptsSnap.size;
  if (attemptCount >= MAX_ATTEMPTS) return { success: false, reason: "max_attempts", attemptsUsed: attemptCount, maxAttempts: MAX_ATTEMPTS };

  const roll = crypto.randomInt(0, 10000);
  const success = roll < 20;
  const currentAttempt = attemptCount + 1;
  await db.collection("captures").add({
    pseudo: cleanPseudo, deviceId, eventId, roll, success, attemptNumber: currentAttempt,
    pokemon, encounterId: input?.encounterId ?? `${pokemon}_001`,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  if (success) {
    await db.collection("winners").add({
      pseudo: cleanPseudo, deviceId, eventId, roll, attemptNumber: currentAttempt,
      pokemon, encounterId: input?.encounterId ?? `${pokemon}_001`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return { success, roll, attemptNumber: currentAttempt, attemptsRemaining: MAX_ATTEMPTS - currentAttempt };
});

exports.checkAttempts = functions.https.onCall(async (data) => {
  const input = getInput(data);
  const deviceId = input?.deviceId;
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) return { attemptsUsed: 0, maxAttempts: MAX_ATTEMPTS, blocked: false };
  const eventSnap = await db.doc(EVENT_DOC).get();
  if (!eventSnap.exists || !eventSnap.data()?.active) return { attemptsUsed: 0, maxAttempts: MAX_ATTEMPTS, blocked: false };
  const startedAt = eventSnap.data().startedAt?.toMillis?.() ?? 0;
  const eventId = String(startedAt);
  const attemptsSnap = await db.collection("captures").where("deviceId", "==", deviceId).where("eventId", "==", eventId).get();
  const attemptsUsed = attemptsSnap.size;
  const hasWon = attemptsSnap.docs.some((doc) => doc.data().success === true);
  return { attemptsUsed, maxAttempts: MAX_ATTEMPTS, blocked: attemptsUsed >= MAX_ATTEMPTS || hasWon, hasWon };
});

/* ═══════════════════════════════════════════════
   BOSS EVENT — Quiz & Beasts Results
   ═══════════════════════════════════════════════ */

exports.submitQuizResult = functions.https.onCall(async (data) => {
  const input = getInput(data);
  const { pseudo, deviceId, score, total, passed } = input || {};
  if (!deviceId || !pseudo) return { success: false };

  await db.collection("eventProgress").doc(deviceId).set({
    pseudo, deviceId,
    quizScore: score, quizTotal: total, quizPassed: Boolean(passed),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

exports.submitBeastsResult = functions.https.onCall(async (data) => {
  const input = getInput(data);
  const { pseudo, deviceId, defeated, passed } = input || {};
  if (!deviceId || !pseudo) return { success: false };

  await db.collection("eventProgress").doc(deviceId).set({
    pseudo, deviceId,
    beastsDefeated: defeated, beastsPassed: Boolean(passed),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

// Admin fetches all player progress
exports.getEventProgress = functions.https.onCall(async (data) => {
  const input = getInput(data);
  verifyAdmin(input?.password);

  const snap = await db.collection("eventProgress").orderBy("updatedAt", "desc").get();
  const players = [];
  snap.forEach((doc) => {
    const d = doc.data();
    players.push({
      id: doc.id, pseudo: d.pseudo,
      quizScore: d.quizScore ?? 0, quizTotal: d.quizTotal ?? 15, quizPassed: Boolean(d.quizPassed),
      beastsDefeated: d.beastsDefeated ?? 0, beastsPassed: Boolean(d.beastsPassed),
    });
  });
  return { players };
});

/* ═══════════════════════════════════════════════
   LIVE BATTLES TRACKING
   ═══════════════════════════════════════════════ */

exports.updateLiveBattle = functions.https.onCall(async (data) => {
  const input = getInput(data);
  const deviceId = input?.deviceId;
  const pseudo = input?.pseudo;
  const status = input?.status;
  if (!deviceId || !pseudo) return { success: false };

  const docRef = db.collection("liveBattles").doc(deviceId);

  if (status === "victory" || status === "defeat" || status === "fled") {
    await db.collection("battleResults").add({
      pseudo, status,
      pokemon: input?.pokemon || "raikou",
      currentPokemon: input?.currentPokemon || null,
      raikouHP: input?.raikouHP ?? null,
      raikouMaxHP: input?.raikouMaxHP ?? null,
      battlePhase: input?.battlePhase || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (status === "victory") {
      const eventSnap = await db.doc(EVENT_DOC).get();
      const startedAt = eventSnap.data()?.startedAt?.toMillis?.() ?? 0;
      await db.collection("winners").add({
        pseudo, deviceId, eventId: String(startedAt), roll: 0, attemptNumber: 1,
        pokemon: input?.pokemon || "raikou",
        encounterId: `${input?.pokemon || "raikou"}_battle`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await docRef.delete().catch(() => {});
    return { success: true };
  }

  // Update live battle state — includes extra fields for spectator
  await docRef.set({
    pseudo, deviceId,
    pokemon: input?.pokemon || "raikou",
    currentPokemon: input?.currentPokemon || null,
    currentPokemonHP: input?.currentPokemonHP ?? null,
    currentPokemonMaxHP: input?.currentPokemonMaxHP ?? null,
    raikouHP: input?.raikouHP ?? null,
    raikouMaxHP: input?.raikouMaxHP ?? null,
    pokeballsLeft: input?.pokeballsLeft ?? null,
    lastAction: input?.lastAction || "",
    battlePhase: input?.battlePhase || null,
    currentBeast: input?.currentBeast || null,
    bossPhase: input?.bossPhase || null,
    beastsDefeated: input?.beastsDefeated ?? null,
    log: input?.log || [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

exports.getLiveBattles = functions.https.onCall(async (data) => {
  const input = getInput(data);
  verifyAdmin(input?.password);

  const snap = await db.collection("liveBattles").orderBy("updatedAt", "desc").get();
  const battles = [];
  const now = Date.now();
  snap.forEach((doc) => {
    const d = doc.data();
    const updatedAt = d.updatedAt?.toMillis?.() ?? 0;
    if (now - updatedAt < 120000) { // 2 min window for boss battles
      battles.push({
        id: doc.id, pseudo: d.pseudo, pokemon: d.pokemon,
        currentPokemon: d.currentPokemon,
        currentPokemonHP: d.currentPokemonHP, currentPokemonMaxHP: d.currentPokemonMaxHP,
        raikouHP: d.raikouHP, raikouMaxHP: d.raikouMaxHP,
        pokeballsLeft: d.pokeballsLeft, lastAction: d.lastAction,
        battlePhase: d.battlePhase, currentBeast: d.currentBeast,
        bossPhase: d.bossPhase, beastsDefeated: d.beastsDefeated,
        log: d.log || [], updatedAt,
      });
    }
  });

  const resultsSnap = await db.collection("battleResults").orderBy("timestamp", "desc").limit(30).get();
  const results = [];
  resultsSnap.forEach((doc) => {
    const d = doc.data();
    results.push({
      id: doc.id, pseudo: d.pseudo, status: d.status, pokemon: d.pokemon,
      currentPokemon: d.currentPokemon, battlePhase: d.battlePhase,
      raikouHP: d.raikouHP, raikouMaxHP: d.raikouMaxHP,
      timestamp: d.timestamp?.toDate?.()?.toISOString?.() ?? null,
    });
  });

  return { battles, results };
});

/* ═══════════════════════════════════════════════
   STATS & WINNERS
   ═══════════════════════════════════════════════ */

exports.getWinners = functions.https.onCall(async (data) => {
  const input = getInput(data);
  verifyAdmin(input?.password);
  const winnersSnap = await db.collection("winners").orderBy("timestamp", "desc").limit(100).get();
  const winners = [];
  winnersSnap.forEach((doc) => {
    const d = doc.data();
    winners.push({
      id: doc.id, pseudo: d.pseudo, roll: d.roll, pokemon: d.pokemon ?? "suicune",
      attemptNumber: d.attemptNumber ?? "?", encounterId: d.encounterId,
      timestamp: d.timestamp?.toDate?.()?.toISOString?.() ?? null,
    });
  });
  return { winners };
});

exports.getCaptureStats = functions.https.onCall(async (data) => {
  const input = getInput(data);
  verifyAdmin(input?.password);
  const captures = await db.collection("captures").orderBy("timestamp", "desc").limit(500).get();
  let total = 0; let successes = 0;
  captures.forEach((doc) => { total++; if (doc.data().success) successes++; });
  return { totalAttempts: total, totalCaptures: successes, captureRate: total > 0 ? ((successes / total) * 100).toFixed(2) + "%" : "0%" };
});
