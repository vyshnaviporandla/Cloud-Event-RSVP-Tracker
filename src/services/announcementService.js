import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";

// Listen to announcements in real time
export function listenToAnnouncements(eventId, callback) {
  const announcementsRef = collection(
    db,
    "events",
    eventId,
    "announcements"
  );

  const q = query(
    announcementsRef,
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const announcements = snapshot.docs.map((announcementDoc) => ({
        id: announcementDoc.id,
        ...announcementDoc.data(),
      }));

      callback(announcements);
    },
    (error) => {
      console.error("Announcement listener error:", error);
      callback([]);
    }
  );
}

// Create announcement
export async function createAnnouncement(
  eventId,
  organizerId,
  organizerName,
  message
) {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    throw new Error("Announcement message cannot be empty.");
  }

  if (cleanMessage.length > 500) {
    throw new Error("Announcement must be 500 characters or less.");
  }

  const announcementsRef = collection(
    db,
    "events",
    eventId,
    "announcements"
  );

  return addDoc(announcementsRef, {
    organizerId,
    organizerName: organizerName || "Organizer",
    message: cleanMessage,
    createdAt: serverTimestamp(),
  });
}

// Delete announcement
export async function deleteAnnouncement(
  eventId,
  announcementId
) {
  const announcementRef = doc(
    db,
    "events",
    eventId,
    "announcements",
    announcementId
  );

  return deleteDoc(announcementRef);
}