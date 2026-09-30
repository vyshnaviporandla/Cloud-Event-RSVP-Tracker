import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase";

// Create a new event
export const createEvent = async (eventData, organizerId) => {
  const event = {
    organizerId,

    eventName: eventData.eventName,
    description: eventData.description,
    eventType: eventData.eventType,

    eventDate: eventData.eventDate,
    startTime: eventData.startTime,
    endTime: eventData.endTime,

    venue: eventData.venue,
    onlineLink: eventData.onlineLink || "",

    maximumCapacity: Number(eventData.maximumCapacity),

    registrationDeadline:
      eventData.registrationDeadline || eventData.eventDate,

    status: "PUBLISHED",

    goingCount: 0,
    maybeCount: 0,
    notGoingCount: 0,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const eventRef = await addDoc(
    collection(db, "events"),
    event
  );

  return eventRef.id;
};

// Listen to organizer's events in real time
export const subscribeToOrganizerEvents = (
  organizerId,
  callback
) => {
  const eventsQuery = query(
    collection(db, "events"),
    where("organizerId", "==", organizerId)
  );

  return onSnapshot(eventsQuery, (snapshot) => {
    const events = snapshot.docs.map((eventDoc) => ({
      id: eventDoc.id,
      ...eventDoc.data(),
    }));

    callback(events);
  });
};

// Listen to all published events in real time
export const subscribeToPublishedEvents = (callback) => {
  const eventsQuery = query(
    collection(db, "events"),
    where("status", "==", "PUBLISHED")
  );

  return onSnapshot(eventsQuery, (snapshot) => {
    const events = snapshot.docs.map((eventDoc) => ({
      id: eventDoc.id,
      ...eventDoc.data(),
    }));

    callback(events);
  });
};

// Update an event
export const updateEvent = async (eventId, eventData) => {
  const eventRef = doc(db, "events", eventId);

  await updateDoc(eventRef, {
    ...eventData,
    maximumCapacity: Number(eventData.maximumCapacity),
    updatedAt: serverTimestamp(),
  });
};

// Cancel an event
export const cancelEvent = async (eventId) => {
  const eventRef = doc(db, "events", eventId);

  await updateDoc(eventRef, {
    status: "CANCELLED",
    updatedAt: serverTimestamp(),
  });
};

// Delete an event
export const deleteEvent = async (eventId) => {
  await deleteDoc(doc(db, "events", eventId));
};