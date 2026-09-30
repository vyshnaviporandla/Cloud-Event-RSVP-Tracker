import {
  doc,
  runTransaction,
  getDoc,
} from "firebase/firestore";

import { db } from "../firebase";

const VALID_STATUSES = [
  "GOING",
  "MAYBE",
  "NOT_GOING",
];

export async function setRSVP(
  eventId,
  userId,
  userName,
  status
) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid RSVP status.");
  }

  if (!eventId || !userId) {
    throw new Error("Event ID and User ID are required.");
  }

  const eventRef = doc(db, "events", eventId);

  const rsvpRef = doc(
    db,
    "events",
    eventId,
    "rsvps",
    userId
  );

  await runTransaction(db, async (transaction) => {
    const eventSnapshot =
      await transaction.get(eventRef);

    if (!eventSnapshot.exists()) {
      throw new Error("Event does not exist.");
    }

    const eventData = eventSnapshot.data();

    if (eventData.status === "CANCELLED") {
      throw new Error(
        "This event has been cancelled."
      );
    }

    if (
      eventData.registrationDeadline &&
      new Date(eventData.registrationDeadline) <
        new Date()
    ) {
      throw new Error(
        "Registration deadline has passed."
      );
    }

    const rsvpSnapshot =
      await transaction.get(rsvpRef);

    const previousStatus =
      rsvpSnapshot.exists()
        ? rsvpSnapshot.data().status
        : null;

    if (previousStatus === status) {
      return;
    }

    let goingCount =
      eventData.goingCount || 0;

    let maybeCount =
      eventData.maybeCount || 0;

    let notGoingCount =
      eventData.notGoingCount || 0;

    // Remove previous RSVP count
    if (previousStatus === "GOING") {
      goingCount = Math.max(0, goingCount - 1);
    }

    if (previousStatus === "MAYBE") {
      maybeCount = Math.max(0, maybeCount - 1);
    }

    if (previousStatus === "NOT_GOING") {
      notGoingCount = Math.max(
        0,
        notGoingCount - 1
      );
    }

    // Capacity check for a new GOING RSVP
    if (
      status === "GOING" &&
      previousStatus !== "GOING" &&
      goingCount >=
        Number(eventData.maximumCapacity)
    ) {
      throw new Error(
        "This event is full."
      );
    }

    // Add new RSVP count
    if (status === "GOING") {
      goingCount += 1;
    }

    if (status === "MAYBE") {
      maybeCount += 1;
    }

    if (status === "NOT_GOING") {
      notGoingCount += 1;
    }

    const newEventStatus =
      goingCount >=
      Number(eventData.maximumCapacity)
        ? "FULL"
        : "PUBLISHED";

    transaction.set(rsvpRef, {
      userId,
      userName: userName || "Attendee",
      status,
      updatedAt: new Date(),
    });

    transaction.update(eventRef, {
      goingCount,
      maybeCount,
      notGoingCount,
      status: newEventStatus,
      updatedAt: new Date(),
    });
  });
}

export async function cancelRSVP(
  eventId,
  userId
) {
  if (!eventId || !userId) {
    throw new Error(
      "Event ID and User ID are required."
    );
  }

  const eventRef = doc(db, "events", eventId);

  const rsvpRef = doc(
    db,
    "events",
    eventId,
    "rsvps",
    userId
  );

  await runTransaction(db, async (transaction) => {
    const eventSnapshot =
      await transaction.get(eventRef);

    const rsvpSnapshot =
      await transaction.get(rsvpRef);

    if (!eventSnapshot.exists()) {
      throw new Error("Event does not exist.");
    }

    if (!rsvpSnapshot.exists()) {
      return;
    }

    const eventData = eventSnapshot.data();
    const rsvpData = rsvpSnapshot.data();

    let goingCount =
      eventData.goingCount || 0;

    let maybeCount =
      eventData.maybeCount || 0;

    let notGoingCount =
      eventData.notGoingCount || 0;

    if (rsvpData.status === "GOING") {
      goingCount = Math.max(
        0,
        goingCount - 1
      );
    }

    if (rsvpData.status === "MAYBE") {
      maybeCount = Math.max(
        0,
        maybeCount - 1
      );
    }

    if (rsvpData.status === "NOT_GOING") {
      notGoingCount = Math.max(
        0,
        notGoingCount - 1
      );
    }

    const newEventStatus =
      goingCount >=
      Number(eventData.maximumCapacity)
        ? "FULL"
        : "PUBLISHED";

    transaction.delete(rsvpRef);

    transaction.update(eventRef, {
      goingCount,
      maybeCount,
      notGoingCount,
      status: newEventStatus,
      updatedAt: new Date(),
    });
  });
}

export async function getMyRSVP(
  eventId,
  userId
) {
  const rsvpRef = doc(
    db,
    "events",
    eventId,
    "rsvps",
    userId
  );

  const snapshot = await getDoc(rsvpRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data();
}