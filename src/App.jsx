import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { auth, db } from "./firebase";

import {
  setRSVP,
  cancelRSVP,
  getMyRSVP,
} from "./services/rsvpService";

import {
  listenToAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from "./services/announcementService";

import "./App.css";
function EventAnalytics({ event }) {
  const capacity = Number(event.maximumCapacity || 0);
  const going = Number(event.goingCount || 0);
  const maybe = Number(event.maybeCount || 0);
  const notGoing = Number(event.notGoingCount || 0);

  const registered = going + maybe + notGoing;
  const available = Math.max(capacity - going, 0);

  const registrationRate =
    capacity > 0
      ? Math.min(Math.round((registered / capacity) * 100), 100)
      : 0;

  const goingRate =
    capacity > 0
      ? Math.min(Math.round((going / capacity) * 100), 100)
      : 0;

  return (
    <div className="analytics-section">

      <div className="analytics-header">
        <div>
          <h3>Event Analytics</h3>
          <p>Real-time registration overview</p>
        </div>

        <span className={`analytics-status ${event.status === "FULL" ? "full" : ""}`}>
          {event.status}
        </span>
      </div>

      <div className="analytics-grid">

        <div className="analytics-card">
          <span className="analytics-label">Capacity</span>
          <strong>{capacity}</strong>
          <small>Total seats</small>
        </div>

        <div className="analytics-card">
          <span className="analytics-label">Going</span>
          <strong>{going}</strong>
          <small>Confirmed attendees</small>
        </div>

        <div className="analytics-card">
          <span className="analytics-label">Maybe</span>
          <strong>{maybe}</strong>
          <small>Potential attendees</small>
        </div>

        <div className="analytics-card">
          <span className="analytics-label">Not Going</span>
          <strong>{notGoing}</strong>
          <small>Declined</small>
        </div>

        <div className="analytics-card">
          <span className="analytics-label">Available</span>
          <strong>{available}</strong>
          <small>Remaining capacity</small>
        </div>

        <div className="analytics-card">
          <span className="analytics-label">Registered</span>
          <strong>{registered}</strong>
          <small>Total responses</small>
        </div>

      </div>

      <div className="analytics-progress">

        <div className="progress-heading">
          <span>Registration Rate</span>
          <strong>{registrationRate}%</strong>
        </div>

        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${registrationRate}%` }}
          />
        </div>

      </div>

      <div className="analytics-progress">

        <div className="progress-heading">
          <span>Confirmed Attendance</span>
          <strong>{goingRate}%</strong>
        </div>

        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${goingRate}%` }}
          />
        </div>

      </div>

    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("attendee");

  const [authError, setAuthError] = useState("");
  const [message, setMessage] = useState("");

  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [announcements, setAnnouncements] = useState([]);
  const [announcementText, setAnnouncementText] = useState("");

  const [myRSVPs, setMyRSVPs] = useState({});
  const [processingRSVP, setProcessingRSVP] = useState(null);

  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const [eventForm, setEventForm] = useState({
    eventName: "",
    description: "",
    eventType: "Workshop",
    eventDate: "",
    startTime: "",
    endTime: "",
    venue: "",
    onlineLink: "",
    maximumCapacity: 50,
    registrationDeadline: "",
  });

  // ----------------------------------------------------
  // AUTH LISTENER
  // ----------------------------------------------------

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ----------------------------------------------------
  // PROFILE LISTENER
  // ----------------------------------------------------

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const userRef = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile({
            id: snapshot.id,
            ...snapshot.data(),
          });
        }
      },
      (error) => {
        console.error("Profile error:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // ----------------------------------------------------
  // EVENTS LISTENER
  // ----------------------------------------------------

  useEffect(() => {
    if (!user || !profile) {
      setEvents([]);
      return;
    }

    let q;

    if (profile.role === "organizer") {
      q = query(
        collection(db, "events"),
        where("organizerId", "==", user.uid)
      );
    } else {
      q = query(
        collection(db, "events"),
        where("status", "in", ["PUBLISHED", "FULL"])
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const eventData = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        eventData.sort((a, b) => {
          const dateA = `${a.eventDate || ""} ${a.startTime || ""}`;
          const dateB = `${b.eventDate || ""} ${b.startTime || ""}`;

          return dateA.localeCompare(dateB);
        });

        setEvents(eventData);
      },
      (error) => {
        console.error("Events error:", error);
        setMessage(error.message);
      }
    );

    return () => unsubscribe();
  }, [user, profile]);

  // ----------------------------------------------------
  // RSVP LISTENER
  // ----------------------------------------------------

  useEffect(() => {
    if (!user || profile?.role !== "attendee") {
      setMyRSVPs({});
      return;
    }

    const unsubscribers = [];

    events.forEach((event) => {
      const rsvpRef = doc(
        db,
        "events",
        event.id,
        "rsvps",
        user.uid
      );

      const unsubscribe = onSnapshot(
        rsvpRef,
        (snapshot) => {
          setMyRSVPs((previous) => {
            const updated = { ...previous };

            if (snapshot.exists()) {
              updated[event.id] = snapshot.data().status;
            } else {
              delete updated[event.id];
            }

            return updated;
          });
        },
        (error) => {
          console.error("RSVP listener error:", error);
        }
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [events, user, profile]);

  // ----------------------------------------------------
  // ANNOUNCEMENTS LISTENER
  // ----------------------------------------------------

  useEffect(() => {
    if (!selectedEvent?.id) {
      setAnnouncements([]);
      return;
    }

    const unsubscribe = listenToAnnouncements(
      selectedEvent.id,
      (data) => {
        setAnnouncements(data);
      }
    );

    return () => unsubscribe();
  }, [selectedEvent]);

  // ----------------------------------------------------
  // REGISTER
  // ----------------------------------------------------

  const handleRegister = async (event) => {
    event.preventDefault();

    setAuthError("");
    setMessage("");

    if (!name.trim()) {
      setAuthError("Please enter your name.");
      return;
    }

    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await setDoc(doc(db, "users", result.user.uid), {
        name: name.trim(),
        email: email.trim(),
        role,
        createdAt: serverTimestamp(),
      });

      setMessage("Account created successfully.");
    } catch (error) {
      console.error(error);
      setAuthError(getFriendlyFirebaseError(error));
    }
  };

  // ----------------------------------------------------
  // LOGIN
  // ----------------------------------------------------

  const handleLogin = async (event) => {
    event.preventDefault();

    setAuthError("");
    setMessage("");

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
    } catch (error) {
      console.error(error);
      setAuthError(getFriendlyFirebaseError(error));
    }
  };

  // ----------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------

  const handleLogout = async () => {
    await signOut(auth);

    setProfile(null);
    setSelectedEvent(null);
    setEvents([]);
    setMyRSVPs({});
  };

  // ----------------------------------------------------
  // EVENT FORM
  // ----------------------------------------------------

  const updateEventForm = (field, value) => {
    setEventForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // ----------------------------------------------------
  // CREATE EVENT
  // ----------------------------------------------------

  const handleCreateEvent = async (event) => {
    event.preventDefault();

    if (!user || !profile) return;

    try {
      const maximumCapacity = Number(
        eventForm.maximumCapacity
      );

      if (maximumCapacity < 1) {
        alert("Capacity must be at least 1.");
        return;
      }

      await addDoc(collection(db, "events"), {
        organizerId: user.uid,
        organizerName: profile.name || "Organizer",

        eventName: eventForm.eventName.trim(),
        description: eventForm.description.trim(),
        eventType: eventForm.eventType,

        eventDate: eventForm.eventDate,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,

        venue: eventForm.venue.trim(),
        onlineLink: eventForm.onlineLink.trim(),

        maximumCapacity,

        registrationDeadline:
          eventForm.registrationDeadline || null,

        status: "PUBLISHED",

        goingCount: 0,
        maybeCount: 0,
        notGoingCount: 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setEventForm({
        eventName: "",
        description: "",
        eventType: "Workshop",
        eventDate: "",
        startTime: "",
        endTime: "",
        venue: "",
        onlineLink: "",
        maximumCapacity: 50,
        registrationDeadline: "",
      });

      setShowCreateEvent(false);

      setMessage("Event created successfully.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  // ----------------------------------------------------
  // DELETE EVENT
  // ----------------------------------------------------

  const handleDeleteEvent = async (eventId) => {
    const confirmed = window.confirm(
      "Delete this event? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "events", eventId));

      if (selectedEvent?.id === eventId) {
        setSelectedEvent(null);
      }

      setMessage("Event deleted.");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  // ----------------------------------------------------
  // CANCEL EVENT
  // ----------------------------------------------------

  const handleCancelEvent = async (eventId) => {
    const confirmed = window.confirm(
      "Cancel this event?"
    );

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, "events", eventId), {
        status: "CANCELLED",
        updatedAt: serverTimestamp(),
      });

      setMessage("Event cancelled.");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  // ----------------------------------------------------
  // RSVP
  // ----------------------------------------------------

  const handleRSVP = async (event, status) => {
    if (!user) return;

    setProcessingRSVP(event.id);

    try {
      await setRSVP(
        event.id,
        user.uid,
        profile?.name || user.email,
        status
      );

      setMessage(
        status === "GOING"
          ? "You are registered for this event."
          : status === "MAYBE"
            ? "Your RSVP is marked as Maybe."
            : "Your RSVP is marked as Not Going."
      );
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setProcessingRSVP(null);
    }
  };

  // ----------------------------------------------------
  // CANCEL RSVP
  // ----------------------------------------------------

  const handleCancelRSVP = async (event) => {
    if (!user) return;

    setProcessingRSVP(event.id);

    try {
      await cancelRSVP(event.id, user.uid);

      setMessage("Your RSVP has been cancelled.");
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setProcessingRSVP(null);
    }
  };

  // ----------------------------------------------------
  // ANNOUNCEMENT
  // ----------------------------------------------------

  const handleCreateAnnouncement = async () => {
    if (!selectedEvent) {
      alert("Select an event first.");
      return;
    }

    if (!announcementText.trim()) {
      alert("Please enter an announcement.");
      return;
    }

    try {
      await createAnnouncement(
        selectedEvent.id,
        user.uid,
        profile?.name || "Organizer",
        announcementText
      );

      setAnnouncementText("");
      setMessage("Announcement published.");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!selectedEvent) return;

    try {
      await deleteAnnouncement(
        selectedEvent.id,
        announcementId
      );
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  // ----------------------------------------------------
  // LOADING
  // ----------------------------------------------------

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="spinner"></div>
          <h2>Loading Event Tracker</h2>
          <p>Connecting to Firebase...</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // AUTH SCREEN
  // ----------------------------------------------------

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-left">
          <div className="brand-large">
            <div className="brand-icon">☁</div>

            <h1>Cloud Event</h1>
            <h1>RSVP Tracker</h1>

            <p>
              Plan events, manage registrations,
              and communicate with attendees in real time.
            </p>
          </div>

          <div className="feature-list">
            <div>✓ Cloud-based event management</div>
            <div>✓ Real-time RSVP tracking</div>
            <div>✓ Capacity management</div>
            <div>✓ Live announcements</div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-card">
            <div className="mobile-brand">
              <div className="brand-icon">☁</div>
              <h2>Cloud Event RSVP Tracker</h2>
            </div>

            <div className="auth-tabs">
              <button
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setAuthError("");
                }}
              >
                Login
              </button>

              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setAuthError("");
                }}
              >
                Register
              </button>
            </div>

            <h2>
              {mode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h2>

            <p className="auth-subtitle">
              {mode === "login"
                ? "Login to manage your events and RSVPs."
                : "Join the cloud event management platform."}
            </p>

            {authError && (
              <div className="alert error">
                {authError}
              </div>
            )}

            {message && (
              <div className="alert success">
                {message}
              </div>
            )}

            <form
              onSubmit={
                mode === "login"
                  ? handleLogin
                  : handleRegister
              }
            >
              {mode === "register" && (
                <>
                  <label>Full Name</label>

                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="Enter your name"
                    required
                  />

                  <label>Account Type</label>

                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value)
                    }
                  >
                    <option value="attendee">
                      Attendee
                    </option>

                    <option value="organizer">
                      Organizer
                    </option>
                  </select>
                </>
              )}

              <label>Email</label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="you@example.com"
                required
              />

              <label>Password</label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter password"
                required
                minLength="6"
              />

              <button
                className="primary-button full"
                type="submit"
              >
                {mode === "login"
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>

            <p className="auth-footer">
              Cloud-based academic project using Firebase
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN APP
  // ----------------------------------------------------

  const isOrganizer = profile?.role === "organizer";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-small">☁</div>

          <div>
            <h2>Cloud Event RSVP Tracker</h2>
            <span>
              Real-Time Event Management Platform
            </span>
          </div>
        </div>

        <div className="topbar-user">
          <div className="user-info">
            <strong>
              {profile?.name || user.email}
            </strong>

            <span>
              {isOrganizer
                ? "Organizer"
                : "Attendee"}
            </span>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        {message && (
          <div className="global-message">
            <span>✓</span>
            {message}
          </div>
        )}

        {isOrganizer ? (
          <OrganizerDashboard
            events={events}
            selectedEvent={selectedEvent}
            setSelectedEvent={setSelectedEvent}
            showCreateEvent={showCreateEvent}
            setShowCreateEvent={setShowCreateEvent}
            eventForm={eventForm}
            updateEventForm={updateEventForm}
            handleCreateEvent={handleCreateEvent}
            handleDeleteEvent={handleDeleteEvent}
            handleCancelEvent={handleCancelEvent}
            announcements={announcements}
            announcementText={announcementText}
            setAnnouncementText={setAnnouncementText}
            handleCreateAnnouncement={
              handleCreateAnnouncement
            }
            handleDeleteAnnouncement={
              handleDeleteAnnouncement
            }
          />
        ) : (
          <AttendeeDashboard
            events={events}
            myRSVPs={myRSVPs}
            selectedEvent={selectedEvent}
            setSelectedEvent={setSelectedEvent}
            handleRSVP={handleRSVP}
            handleCancelRSVP={handleCancelRSVP}
            processingRSVP={processingRSVP}
            announcements={announcements}
          />
        )}
      </main>
    </div>
  );
}

// ======================================================
// ORGANIZER DASHBOARD
// ======================================================

function OrganizerDashboard({
  events,
  selectedEvent,
  setSelectedEvent,
  showCreateEvent,
  setShowCreateEvent,
  eventForm,
  updateEventForm,
  handleCreateEvent,
  handleDeleteEvent,
  handleCancelEvent,
  announcements,
  announcementText,
  setAnnouncementText,
  handleCreateAnnouncement,
  handleDeleteAnnouncement,
}) {
  return (
    <div>
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            ORGANIZER DASHBOARD
          </span>

          <h1>Manage your events</h1>

          <p>
            Create events, monitor registrations,
            and communicate with attendees.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() =>
            setShowCreateEvent(!showCreateEvent)
          }
        >
          + Create Event
        </button>
      </section>

      {showCreateEvent && (
        <section className="panel create-panel">
          <div className="panel-title">
            <div>
              <h2>Create New Event</h2>
              <p>Enter the event details below.</p>
            </div>

            <button
              className="close-button"
              onClick={() =>
                setShowCreateEvent(false)
              }
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCreateEvent}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Event Name</label>

                <input
                  value={eventForm.eventName}
                  onChange={(e) =>
                    updateEventForm(
                      "eventName",
                      e.target.value
                    )
                  }
                  placeholder="Cloud Computing Workshop"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Description</label>

                <textarea
                  value={eventForm.description}
                  onChange={(e) =>
                    updateEventForm(
                      "description",
                      e.target.value
                    )
                  }
                  placeholder="Describe your event..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label>Event Type</label>

                <select
                  value={eventForm.eventType}
                  onChange={(e) =>
                    updateEventForm(
                      "eventType",
                      e.target.value
                    )
                  }
                >
                  <option>Workshop</option>
                  <option>Seminar</option>
                  <option>Conference</option>
                  <option>Hackathon</option>
                  <option>Meeting</option>
                  <option>Competition</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Maximum Capacity</label>

                <input
                  type="number"
                  min="1"
                  value={eventForm.maximumCapacity}
                  onChange={(e) =>
                    updateEventForm(
                      "maximumCapacity",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Event Date</label>

                <input
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) =>
                    updateEventForm(
                      "eventDate",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Registration Deadline</label>

                <input
                  type="datetime-local"
                  value={
                    eventForm.registrationDeadline
                  }
                  onChange={(e) =>
                    updateEventForm(
                      "registrationDeadline",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label>Start Time</label>

                <input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) =>
                    updateEventForm(
                      "startTime",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>End Time</label>

                <input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) =>
                    updateEventForm(
                      "endTime",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Venue</label>

                <input
                  value={eventForm.venue}
                  onChange={(e) =>
                    updateEventForm(
                      "venue",
                      e.target.value
                    )
                  }
                  placeholder="KITS Warangal"
                  required
                />
              </div>

              <div className="form-group">
                <label>Online Meeting Link</label>

                <input
                  type="url"
                  value={eventForm.onlineLink}
                  onChange={(e) =>
                    updateEventForm(
                      "onlineLink",
                      e.target.value
                    )
                  }
                  placeholder="https://meet.google.com/..."
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowCreateEvent(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
              >
                Publish Event
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="stats-grid">
        <StatCard
          icon="📅"
          label="Total Events"
          value={events.length}
        />

        <StatCard
          icon="🟢"
          label="Published"
          value={
            events.filter(
              (event) =>
                event.status === "PUBLISHED"
            ).length
          }
        />

        <StatCard
          icon="👥"
          label="Total Going"
          value={events.reduce(
            (sum, event) =>
              sum + (event.goingCount || 0),
            0
          )}
        />

        <StatCard
          icon="📢"
          label="Announcements"
          value={announcements.length}
        />
      </section>

      <div className="content-layout">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>My Events</h2>
              <p>Manage your published events.</p>
            </div>
          </div>

          {events.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No events yet"
              text="Create your first event to get started."
            />
          ) : (
            <div className="event-list">
          {events.map((event) => (
            <div key={event.id}>
              <OrganizerEventCard
                event={event}
                selected={
                  selectedEvent?.id === event.id
                }
                onSelect={() =>
                  setSelectedEvent(event)
                }
                onDelete={() =>
                  handleDeleteEvent(event.id)
                }
                onCancel={() =>
                  handleCancelEvent(event.id)
                }
              />

              {selectedEvent?.id === event.id && (
                <EventAnalytics event={event} />
              )}
            </div>
          ))}
        </div>
          )}
        </section>

        <section className="panel details-panel">
          {selectedEvent ? (
            <>
              <EventDetails event={selectedEvent} />

              <div className="divider"></div>

              <AnnouncementManager
                announcements={announcements}
                announcementText={announcementText}
                setAnnouncementText={
                  setAnnouncementText
                }
                onCreate={
                  handleCreateAnnouncement
                }
                onDelete={
                  handleDeleteAnnouncement
                }
              />
            </>
          ) : (
            <EmptyState
              icon="👈"
              title="Select an event"
              text="Choose an event to view details and manage announcements."
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ======================================================
// ATTENDEE DASHBOARD
// ======================================================

function AttendeeDashboard({
  events,
  myRSVPs,
  selectedEvent,
  setSelectedEvent,
  handleRSVP,
  handleCancelRSVP,
  processingRSVP,
  announcements,
}) {
  const goingCount = Object.values(myRSVPs).filter(
    (status) => status === "GOING"
  ).length;

  const maybeCount = Object.values(myRSVPs).filter(
    (status) => status === "MAYBE"
  ).length;

  return (
    <div>
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            ATTENDEE DASHBOARD
          </span>

          <h1>Discover upcoming events</h1>

          <p>
            Browse events and manage your RSVP status.
          </p>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          icon="📅"
          label="Available Events"
          value={events.length}
        />

        <StatCard
          icon="✅"
          label="Going"
          value={goingCount}
        />

        <StatCard
          icon="🤔"
          label="Maybe"
          value={maybeCount}
        />

        <StatCard
          icon="📢"
          label="Live Updates"
          value={announcements.length}
        />
      </section>

      <div className="content-layout">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Upcoming Events</h2>
              <p>Real-time event listings.</p>
            </div>
          </div>

          {events.length === 0 ? (
            <EmptyState
              icon="🔎"
              title="No events available"
              text="Check back later for new events."
            />
          ) : (
            <div className="event-list">
              {events.map((event) => (
                <AttendeeEventCard
                  key={event.id}
                  event={event}
                  selected={
                    selectedEvent?.id === event.id
                  }
                  rsvp={myRSVPs[event.id]}
                  processing={
                    processingRSVP === event.id
                  }
                  onSelect={() =>
                    setSelectedEvent(event)
                  }
                  onRSVP={(status) =>
                    handleRSVP(event, status)
                  }
                  onCancel={() =>
                    handleCancelRSVP(event)
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel details-panel">
          {selectedEvent ? (
            <>
              <EventDetails event={selectedEvent} />

              <div className="divider"></div>

              <AnnouncementList
                announcements={announcements}
              />
            </>
          ) : (
            <EmptyState
              icon="👈"
              title="Select an event"
              text="Choose an event to view its details and announcements."
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ======================================================
// EVENT CARD
// ======================================================

function OrganizerEventCard({
  event,
  selected,
  onSelect,
  onDelete,
  onCancel,
}) {
  return (
    <div
      className={`event-card ${
        selected ? "selected" : ""
      }`}
    >
      <div
        className="event-card-main"
        onClick={onSelect}
      >
        <div className="event-icon">
          {getEventIcon(event.eventType)}
        </div>

        <div className="event-card-content">
          <div className="event-card-top">
            <span
              className={`status-badge ${event.status.toLowerCase()}`}
            >
              {event.status}
            </span>

            <span className="event-type">
              {event.eventType}
            </span>
          </div>

          <h3>{event.eventName}</h3>

          <p>{event.description}</p>

          <div className="event-meta">
            <span>📅 {formatDate(event.eventDate)}</span>
            <span>🕐 {event.startTime}</span>
            <span>📍 {event.venue}</span>
          </div>
        </div>
      </div>

      <div className="event-stats">
        <div>
          <strong>{event.goingCount || 0}</strong>
          <span>Going</span>
        </div>

        <div>
          <strong>{event.maybeCount || 0}</strong>
          <span>Maybe</span>
        </div>

        <div>
          <strong>{event.notGoingCount || 0}</strong>
          <span>Not Going</span>
        </div>
      </div>

      <div className="event-actions">
        <button
          className="secondary-button small"
          onClick={onSelect}
        >
          Details
        </button>

        {event.status !== "CANCELLED" && (
          <button
            className="warning-button small"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}

        <button
          className="danger-button small"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ======================================================
// ATTENDEE EVENT CARD
// ======================================================

function AttendeeEventCard({
  event,
  selected,
  rsvp,
  processing,
  onSelect,
  onRSVP,
  onCancel,
}) {
  const isFull = event.status === "FULL";

  return (
    <div
      className={`event-card attendee-card ${
        selected ? "selected" : ""
      }`}
    >
      <div
        className="event-card-main"
        onClick={onSelect}
      >
        <div className="event-icon">
          {getEventIcon(event.eventType)}
        </div>

        <div className="event-card-content">
          <div className="event-card-top">
            <span
              className={`status-badge ${event.status.toLowerCase()}`}
            >
              {isFull ? "FULL" : event.status}
            </span>

            <span className="event-type">
              {event.eventType}
            </span>
          </div>

          <h3>{event.eventName}</h3>

          <p>{event.description}</p>

          <div className="event-meta">
            <span>📅 {formatDate(event.eventDate)}</span>
            <span>🕐 {event.startTime}</span>
            <span>📍 {event.venue}</span>
          </div>
        </div>
      </div>

      <div className="capacity-bar-wrapper">
        <div className="capacity-label">
          <span>Capacity</span>

          <strong>
            {event.goingCount || 0}/
            {event.maximumCapacity}
          </strong>
        </div>

        <div className="capacity-bar">
          <div
            className="capacity-fill"
            style={{
              width: `${Math.min(
                100,
                ((event.goingCount || 0) /
                  event.maximumCapacity) *
                  100
              )}%`,
            }}
          ></div>
        </div>
      </div>

      <div className="rsvp-actions">
        <button
          className={
            rsvp === "GOING"
              ? "rsvp-button active-going"
              : "rsvp-button"
          }
          disabled={
            processing ||
            (isFull && rsvp !== "GOING")
          }
          onClick={() => onRSVP("GOING")}
        >
          ✓ Going
        </button>

        <button
          className={
            rsvp === "MAYBE"
              ? "rsvp-button active-maybe"
              : "rsvp-button"
          }
          disabled={processing}
          onClick={() => onRSVP("MAYBE")}
        >
          ? Maybe
        </button>

        <button
          className={
            rsvp === "NOT_GOING"
              ? "rsvp-button active-not-going"
              : "rsvp-button"
          }
          disabled={processing}
          onClick={() => onRSVP("NOT_GOING")}
        >
          × Not Going
        </button>

        {rsvp && (
          <button
            className="cancel-rsvp"
            disabled={processing}
            onClick={onCancel}
          >
            Cancel RSVP
          </button>
        )}
      </div>
    </div>
  );
}

// ======================================================
// EVENT DETAILS
// ======================================================

function EventDetails({ event }) {
  return (
    <div>
      <div className="details-header">
        <span
          className={`status-badge ${event.status.toLowerCase()}`}
        >
          {event.status}
        </span>

        <span className="event-type">
          {event.eventType}
        </span>
      </div>

      <h2 className="details-title">
        {event.eventName}
      </h2>

      <p className="details-description">
        {event.description}
      </p>

      <div className="detail-grid">
        <DetailItem
          icon="📅"
          label="Date"
          value={formatDate(event.eventDate)}
        />

        <DetailItem
          icon="🕐"
          label="Time"
          value={`${event.startTime} - ${event.endTime}`}
        />

        <DetailItem
          icon="📍"
          label="Venue"
          value={event.venue || "Not specified"}
        />

        <DetailItem
          icon="👥"
          label="Capacity"
          value={`${event.goingCount || 0} / ${event.maximumCapacity}`}
        />

        <DetailItem
          icon="👤"
          label="Organizer"
          value={event.organizerName || "Organizer"}
        />

        <DetailItem
          icon="🎟️"
          label="Registration"
          value={
            event.registrationDeadline
              ? formatDeadline(
                  event.registrationDeadline
                )
              : "Open"
          }
        />
      </div>

      {event.onlineLink && (
        <a
          className="meeting-link"
          href={event.onlineLink}
          target="_blank"
          rel="noreferrer"
        >
          🔗 Join Online Meeting
        </a>
      )}

      <div className="attendance-summary">
        <div className="summary-item going">
          <strong>{event.goingCount || 0}</strong>
          <span>Going</span>
        </div>

        <div className="summary-item maybe">
          <strong>{event.maybeCount || 0}</strong>
          <span>Maybe</span>
        </div>

        <div className="summary-item not-going">
          <strong>
            {event.notGoingCount || 0}
          </strong>
          <span>Not Going</span>
        </div>
      </div>
    </div>
  );
}

// ======================================================
// ANNOUNCEMENTS
// ======================================================

function AnnouncementManager({
  announcements,
  announcementText,
  setAnnouncementText,
  onCreate,
  onDelete,
}) {
  return (
    <div className="announcements">
      <div className="section-heading">
        <div>
          <h3>📢 Announcements</h3>
          <p>Send live updates to attendees.</p>
        </div>
      </div>

      <div className="announcement-compose">
        <textarea
          value={announcementText}
          onChange={(e) =>
            setAnnouncementText(e.target.value)
          }
          placeholder="Write an announcement..."
          rows="3"
        />

        <button
          className="primary-button"
          onClick={onCreate}
        >
          Publish Announcement
        </button>
      </div>

      <AnnouncementList
        announcements={announcements}
        organizer
        onDelete={onDelete}
      />
    </div>
  );
}

function AnnouncementList({
  announcements,
  organizer = false,
  onDelete,
}) {
  return (
    <div className="announcements">
      <div className="section-heading">
        <div>
          <h3>📢 Announcements</h3>
          <p>Live updates from the organizer.</p>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="empty-announcements">
          <span>📭</span>
          <p>No announcements yet.</p>
        </div>
      ) : (
        <div className="announcement-list">
          {announcements.map((announcement) => (
            <div
              className="announcement-card"
              key={announcement.id}
            >
              <div className="announcement-icon">
                📢
              </div>

              <div className="announcement-content">
                <div className="announcement-top">
                  <strong>
                    {announcement.organizerName ||
                      "Organizer"}
                  </strong>

                  {organizer && (
                    <button
                      className="delete-icon"
                      onClick={() =>
                        onDelete(
                          announcement.id
                        )
                      }
                    >
                      🗑
                    </button>
                  )}
                </div>

                <p>{announcement.message}</p>

                <small>
                  {formatTimestamp(
                    announcement.createdAt
                  )}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================================================
// SMALL COMPONENTS
// ======================================================

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="detail-item">
      <div className="detail-icon">{icon}</div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

// ======================================================
// HELPERS
// ======================================================

function formatDate(dateString) {
  if (!dateString) return "Date not specified";

  try {
    return new Date(
      `${dateString}T00:00:00`
    ).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function formatDeadline(value) {
  if (!value) return "Open";

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Just now";

  try {
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);

    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Just now";
  }
}

function getEventIcon(type) {
  const icons = {
    Workshop: "💻",
    Seminar: "🎓",
    Conference: "🌐",
    Hackathon: "🚀",
    Meeting: "🤝",
    Competition: "🏆",
    Other: "📅",
  };

  return icons[type] || "📅";
}

function getFriendlyFirebaseError(error) {
  const code = error?.code || "";

  const messages = {
    "auth/email-already-in-use":
      "This email is already registered.",
    "auth/invalid-email":
      "Please enter a valid email address.",
    "auth/weak-password":
      "Password should contain at least 6 characters.",
    "auth/invalid-credential":
      "Invalid email or password.",
    "auth/user-not-found":
      "No account was found with this email.",
    "auth/wrong-password":
      "Incorrect password.",
    "auth/too-many-requests":
      "Too many attempts. Please try again later.",
  };

  return (
    messages[code] ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

export default App;