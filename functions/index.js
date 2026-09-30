const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const VALID_STATUSES = ["GOING", "MAYBE", "NOT_GOING"];

/**
 * Secure RSVP API
 *
 * Client calls this Cloud Function instead of directly
 * modifying event counters.
 *
 * The entire RSVP operation happens inside a Firestore
 * transaction, making capacity updates concurrency-safe.
 */
exports.setRSVP = onCall(async (request) => {
  // ---------------------------------------------
  // 1. AUTHENTICATION
  // ---------------------------------------------

  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to RSVP."
    );
  }

  const userId = request.auth.uid;

  // ---------------------------------------------
  // 2. INPUT VALIDATION
  // ---------------------------------------------

  const { eventId, status } = request.data || {};

  if (!eventId || typeof eventId !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "A valid eventId is required."
    );
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid RSVP status."
    );
  }

  const eventRef = db.collection("events").doc(eventId);

  const rsvpId = `${eventId}_${userId}`;

  const rsvpRef = db.collection("rsvps").doc(rsvpId);

  // ---------------------------------------------
  // 3. FIRESTORE TRANSACTION
  // ---------------------------------------------

  const result = await db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    const rsvpSnapshot = await transaction.get(rsvpRef);

    if (!eventSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Event does not exist."
      );
    }

    const event = eventSnapshot.data();

    // ---------------------------------------------
    // 4. EVENT VALIDATION
    // ---------------------------------------------

    if (event.status === "CANCELLED") {
      throw new HttpsError(
        "failed-precondition",
        "This event has been cancelled."
      );
    }

    // ---------------------------------------------
    // 5. REGISTRATION DEADLINE
    // ---------------------------------------------

    if (event.registrationDeadline) {
      const deadline = new Date(event.registrationDeadline);

      if (
        !Number.isNaN(deadline.getTime()) &&
        new Date() > deadline
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Registration deadline has passed."
        );
      }
    }

    // ---------------------------------------------
    // 6. EXISTING RSVP
    // ---------------------------------------------

    const oldStatus = rsvpSnapshot.exists
      ? rsvpSnapshot.data().status
      : null;

    // Nothing changed
    if (oldStatus === status) {
      return {
        success: true,
        message: "RSVP already has this status.",
        status,
      };
    }

    // ---------------------------------------------
    // 7. CURRENT COUNTERS
    // ---------------------------------------------

    let goingCount = Number(event.goingCount || 0);
    let maybeCount = Number(event.maybeCount || 0);
    let notGoingCount = Number(event.notGoingCount || 0);

    const capacity = Number(event.maximumCapacity || 0);

    // ---------------------------------------------
    // 8. REMOVE OLD RSVP COUNT
    // ---------------------------------------------

    if (oldStatus === "GOING") {
      goingCount = Math.max(0, goingCount - 1);
    }

    if (oldStatus === "MAYBE") {
      maybeCount = Math.max(0, maybeCount - 1);
    }

    if (oldStatus === "NOT_GOING") {
      notGoingCount = Math.max(0, notGoingCount - 1);
    }

    // ---------------------------------------------
    // 9. CAPACITY CHECK
    // ---------------------------------------------

    if (
      status === "GOING" &&
      oldStatus !== "GOING" &&
      capacity > 0 &&
      goingCount >= capacity
    ) {
      throw new HttpsError(
        "resource-exhausted",
        `This event is full. Maximum capacity is ${capacity}.`
      );
    }

    // ---------------------------------------------
    // 10. ADD NEW RSVP COUNT
    // ---------------------------------------------

    if (status === "GOING") {
      goingCount++;
    }

    if (status === "MAYBE") {
      maybeCount++;
    }

    if (status === "NOT_GOING") {
      notGoingCount++;
    }

    // ---------------------------------------------
    // 11. EVENT STATUS
    // ---------------------------------------------

    let eventStatus = event.status;

    if (capacity > 0 && goingCount >= capacity) {
      eventStatus = "FULL";
    } else {
      eventStatus = "PUBLISHED";
    }

    // ---------------------------------------------
    // 12. SAVE RSVP
    // ---------------------------------------------

    transaction.set(
      rsvpRef,
      {
        eventId,
        userId,
        status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // ---------------------------------------------
    // 13. UPDATE EVENT
    // ---------------------------------------------

    transaction.update(eventRef, {
      goingCount,
      maybeCount,
      notGoingCount,
      status: eventStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      status,
      goingCount,
      maybeCount,
      notGoingCount,
      eventStatus,
    };
  });

  return result;
});


/**
 * Cancel an existing RSVP.
 */
exports.cancelRSVP = onCall(async (request) => {
  // ---------------------------------------------
  // 1. AUTHENTICATION
  // ---------------------------------------------

  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in."
    );
  }

  const userId = request.auth.uid;

  const { eventId } = request.data || {};

  if (!eventId || typeof eventId !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "A valid eventId is required."
    );
  }

  const eventRef = db.collection("events").doc(eventId);

  const rsvpId = `${eventId}_${userId}`;

  const rsvpRef = db.collection("rsvps").doc(rsvpId);

  // ---------------------------------------------
  // 2. TRANSACTION
  // ---------------------------------------------

  const result = await db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    const rsvpSnapshot = await transaction.get(rsvpRef);

    if (!eventSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Event does not exist."
      );
    }

    if (!rsvpSnapshot.exists) {
      return {
        success: true,
        message: "No RSVP found.",
      };
    }

    const event = eventSnapshot.data();
    const rsvp = rsvpSnapshot.data();

    let goingCount = Number(event.goingCount || 0);
    let maybeCount = Number(event.maybeCount || 0);
    let notGoingCount = Number(event.notGoingCount || 0);

    // Remove RSVP count
    if (rsvp.status === "GOING") {
      goingCount = Math.max(0, goingCount - 1);
    }

    if (rsvp.status === "MAYBE") {
      maybeCount = Math.max(0, maybeCount - 1);
    }

    if (rsvp.status === "NOT_GOING") {
      notGoingCount = Math.max(0, notGoingCount - 1);
    }

    const capacity = Number(event.maximumCapacity || 0);

    let eventStatus = event.status;

    if (eventStatus !== "CANCELLED") {
      if (capacity > 0 && goingCount >= capacity) {
        eventStatus = "FULL";
      } else {
        eventStatus = "PUBLISHED";
      }
    }

    // Delete RSVP
    transaction.delete(rsvpRef);

    // Update event
    transaction.update(eventRef, {
      goingCount,
      maybeCount,
      notGoingCount,
      status: eventStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: "RSVP cancelled successfully.",
      goingCount,
      maybeCount,
      notGoingCount,
      eventStatus,
    };
  });

  return result;
});