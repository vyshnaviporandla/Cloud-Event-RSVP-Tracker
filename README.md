# ☁️ Real-Time Cloud-Based Event Planning & RSVP Tracker

A real-time cloud-based event management and RSVP platform built using React, Vite, Firebase Authentication, Cloud Firestore and Firebase Hosting.

The system provides separate experiences for organizers and attendees, allowing organizers to create and manage events while attendees can view events and respond to them in real time.

---

## 🌐 Live Demo

https://cloud-event-rsvp-tracker-1155a.web.app

---

## 📌 Project Overview

Traditional event management systems often require manual registration tracking and separate communication channels.

This project provides a centralized cloud-based platform where:

- Organizers can create and manage events
- Attendees can discover available events
- Attendees can RSVP in real time
- Event capacity can be monitored
- Organizers can view participation analytics
- Organizers can publish announcements
- Data is synchronized using Cloud Firestore

The project demonstrates practical implementation of cloud computing concepts using managed cloud services.

---

## 🎯 Objectives

- Build a real-time cloud-based event management system
- Implement authentication and role-based access
- Store application data in a NoSQL cloud database
- Provide real-time RSVP updates
- Implement event capacity management
- Provide event analytics
- Implement cloud-based announcements
- Apply Firestore security rules
- Deploy the application to the cloud
- Maintain the project using Git and GitHub

---

## ✨ Features

### 👨‍💼 Organizer

- Organizer registration/login
- Create events
- Manage created events
- Publish events
- Cancel events
- Delete events
- View RSVP statistics
- View event analytics
- Monitor available capacity
- Publish announcements
- Delete announcements

### 👥 Attendee

- Attendee registration/login
- View published events
- View event details
- RSVP as:
  - GOING
  - MAYBE
  - NOT GOING
- Change RSVP status
- Cancel RSVP
- View event announcements
- See real-time event availability

### 📊 Analytics

The organizer dashboard provides:

- Maximum capacity
- Going count
- Maybe count
- Not Going count
- Total registered participants
- Available seats
- Registration rate
- Going rate
- Event status

---

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Build Tool | Vite |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Hosting | Firebase Hosting |
| Programming Language | JavaScript |
| Version Control | Git |
| Repository | GitHub |

---

## ☁️ Cloud Architecture

```text
                   ┌──────────────────────┐
                   │       User           │
                   │ Organizer / Attendee │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │   React + Vite App   │
                   └──────────┬───────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌────────────┐ ┌────────────┐ ┌─────────────┐
        │  Firebase  │ │  Firestore │ │   Firebase  │
        │    Auth    │ │  Database  │ │   Hosting   │
        └────────────┘ └────────────┘ └─────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Real-Time Event Data │
                   │ RSVP / Announcements │
                   └──────────────────────┘
```
Authentication

Firebase Authentication is used to provide secure user authentication.

The application supports two roles:

Organizer
Attendee

User profile information and role information are stored in Firestore.

🗄️ Firestore Data Structure

The application uses Cloud Firestore as its NoSQL database.

Users
users/{userId}

Example:

{
  name,
  email,
  role
}
Events
events/{eventId}

Example:

{
  organizerId,
  organizerName,
  eventName,
  description,
  eventType,
  eventDate,
  startTime,
  endTime,
  venue,
  onlineLink,
  maximumCapacity,
  registrationDeadline,
  status,
  goingCount,
  maybeCount,
  notGoingCount,
  createdAt,
  updatedAt
}
RSVPs
events/{eventId}/rsvps/{userId}

Example:

{
  userId,
  userName,
  status,
  updatedAt
}
Announcements
events/{eventId}/announcements/{announcementId}
⚡ Real-Time RSVP

The RSVP system uses Firestore transactions to update:

RSVP status
Going count
Maybe count
Not Going count
Event capacity status

This helps maintain consistent counters when multiple users interact with an event.

🚦 Capacity Management

Each event has a maximum capacity.

The system tracks:

Maximum Capacity
        ↓
Going Participants
        ↓
Available Seats

When capacity is reached, the event status can become:

FULL

This prevents additional GOING registrations through the application's capacity logic.

📢 Announcements

Organizers can create announcements for their events.

Attendees can view announcements associated with the event.

This provides a simple centralized communication mechanism.

🔒 Security

Firestore Security Rules are used to control access.

The system applies rules for:

Authenticated users
User-owned profiles
Organizer-owned events
User-owned RSVPs
Organizer announcements

Sensitive environment variables are excluded from Git using .gitignore.

☁️ Cloud Computing Concepts Demonstrated
SaaS

The application is accessed through a web browser without requiring users to install server infrastructure.

PaaS / Managed Cloud Services

Firebase provides managed services for:

Authentication
Database
Hosting
NoSQL Database

Cloud Firestore stores application data using collections and documents.

Real-Time Synchronization

Firestore listeners allow application data to update without manually refreshing the page.

Cloud Hosting

Firebase Hosting serves the production frontend from the cloud.

Scalability

Managed cloud services reduce the need to manually manage servers and infrastructure.

Authentication

Firebase Authentication handles user identity and login.

Security

Firestore Security Rules control access to cloud data.

📁 Project Structure
```text
Cloud-Event-RSVP-Tracker/
│
├── .firebaserc
├── .gitignore
├── firebase.json
├── firestore.rules
├── package.json
├── package-lock.json
├── vite.config.js
│
├── public/
│
├── functions/
│   ├── index.js
│   ├── package.json
│   └── package-lock.json
│
└── src/
    ├── App.jsx
    ├── App.css
    ├── firebase.js
    ├── index.css
    ├── main.jsx
    │
    ├── assets/
    │
    └── services/
        ├── announcementService.js
        ├── authService.js
        ├── eventService.js
        └── rsvpService.js
```
🧪 Testing

The following functionality was tested during development:

Test	Result
User registration	✅
User login	✅
Organizer dashboard	✅
Attendee dashboard	✅
Event creation	✅
Event cancellation	✅
Event deletion	✅
RSVP GOING	✅
RSVP MAYBE	✅
RSVP NOT GOING	✅
RSVP status change	✅
Capacity handling	✅
Real-time counters	✅
Announcements	✅
Analytics	✅
Firestore rules deployment	✅
Production build	✅
Firebase Hosting deployment	✅
🚀 Local Development

Clone the repository:
```text
git clone YOUR_GITHUB_REPOSITORY_URL
```
Navigate into the project:
```text
cd Cloud-Event-RSVP-Tracker
```
Install dependencies:
```text
npm install
```
Start the development server:
```text
npm run dev
```
The application will normally be available at:
```text
http://localhost:5173
🏗️ Production Build
```
Create a production build:
```text
npm run build
```

☁️ Firebase Deployment

Deploy Firestore rules:
```text
firebase deploy --only firestore:rules
```

Deploy the frontend:
```text
firebase deploy --only hosting
```
Or deploy both:
```text
firebase deploy --only firestore:rules,hosting
```

📈 Future Enhancements

Possible future improvements include:

Email notifications
Push notifications
Calendar integration
QR-code based event check-in
Advanced organizer analytics
Event search and filtering
Event categories
Waitlist management
Export RSVP data
Cloud Functions for trusted server-side RSVP processing
Automated CI/CD deployment
Monitoring and logging
Multi-event reporting dashboard

🎓 Learning Outcomes

Through this project, I gained practical experience with:

React application development
Firebase Authentication
Cloud Firestore
Real-time data synchronization
Firestore Security Rules
Cloud hosting
Git and GitHub
Production builds
Cloud deployment
Role-based application design
NoSQL database design
Event-driven application concepts
👨‍💻 Project

Real-Time Cloud-Based Event Planning & RSVP Tracker

Built as a Cloud Computing course project to demonstrate practical use of cloud services and real-time web application architecture.
