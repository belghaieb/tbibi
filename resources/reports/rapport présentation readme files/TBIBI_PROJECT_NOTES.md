# TBIBI — Votre Clinique Virtuelle
## Project Engineering Notes

> CS2 Student Project — Tunisia
> Backend: Spring Boot 3.x · MySQL 8 · JWT · WebSocket · Groq AI · Stripe · Healthsites.io

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technologies Used](#3-technologies-used)
4. [Database — Migration H2 → MySQL](#4-database--migration-h2--mysql)
5. [JWT Authentication System](#5-jwt-authentication-system)
6. [Backend Entities & Database Tables](#6-backend-entities--database-tables)
7. [API Endpoints Reference](#7-api-endpoints-reference)
8. [All Backend Fixes Applied](#8-all-backend-fixes-applied)
9. [External API Integrations](#9-external-api-integrations)
10. [Data Seeder — Default Accounts](#10-data-seeder--default-accounts)
11. [Frontend Structure](#11-frontend-structure)
12. [Role Capabilities](#12-role-capabilities)
13. [Removed Features](#13-removed-features)
14. [File Structure](#14-file-structure)

---

## 1. Project Overview

TBIBI is a virtual clinic web platform for Tunisia. It connects patients with doctors through:
- Appointment booking
- Real-time chat (WebSocket)
- AI medical assistant (Groq LLaMA)
- Nearby medical services map (Healthsites.io + Leaflet.js)
- Medical file management
- Subscription plans with Stripe payment
- Doctor verification system managed by an admin

The platform has **3 user roles**: PATIENT, DOCTOR, ADMIN.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (plain HTML/JS)                  │
│   html/  →  login.html, signup.html, main.html, admin.html      │
│   js/    →  login-page.js, dashboard-page.js, admin-page.js     │
│   CSS    →  Bootstrap 5.3 + custom CSS                          │
│   Libs   →  SockJS, STOMP, Leaflet.js                           │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              SPRING BOOT BACKEND  (port 8084)                    │
│                                                                  │
│  SecurityConfig → JwtFilter → Controllers → Services → Repos    │
│                                                                  │
│  External APIs:                                                  │
│    Groq (LLaMA 3.3-70b) → /api/assistant/chat                   │
│    Healthsites.io        → /api/nearby-medical                   │
│    Stripe                → /api/subscriptions/checkout-session   │
│    OpenStreetMap Tiles   → Leaflet map rendering                 │
└────────────────────────┬────────────────────────────────────────┘
                         │ JPA / Hibernate
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MySQL 8.0  (port 3306)                          │
│  Database: tbibi                                                 │
│  Tables: users, doctor_profiles, appointments, chat_messages,   │
│          medical_files, doctor_verification_docs,                │
│          user_subscriptions, subscriptions                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technologies Used

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Spring Boot | 3.x | Main framework |
| Spring Data JPA | — | Database ORM |
| Hibernate | — | JPA implementation |
| MySQL Connector | 8.0.x | Database driver |
| Spring Security | — | Auth & route protection |
| jjwt (JJWT) | 0.12.3 | JWT token generation & validation |
| BCrypt | — | Password hashing |
| Spring AI | 1.1.4 | AI assistant (Groq/OpenAI-compatible) |
| Spring WebSocket | — | Real-time chat (STOMP + SockJS) |
| Stripe Java SDK | — | Payment processing |
| Lombok | — | @Data, @Builder, @Slf4j, @RequiredArgsConstructor |
| Jackson | — | JSON serialization (LocalDateTime fix) |
| RestTemplate | — | HTTP calls to external APIs |

### Frontend
| Technology | Purpose |
|---|---|
| Bootstrap 5.3 | UI components & layout |
| SockJS | WebSocket polyfill |
| STOMP.js | WebSocket messaging protocol |
| Leaflet.js | Interactive map |
| Fetch API | HTTP requests to backend |
| LocalStorage | Session persistence (JWT token + user object) |

### External APIs
| API | Purpose | Key location |
|---|---|---|
| Groq (api.groq.com) | LLaMA 3.3-70b AI assistant | application.properties |
| Healthsites.io | Nearby medical facilities | application.properties |
| Stripe | Payment checkout sessions | application.properties |
| OpenStreetMap | Map tile rendering | Leaflet (no key needed) |

---

## 4. Database — Migration H2 → MySQL

### What changed

The project originally used **H2 in-memory database** (data lost on restart).
It was migrated to **MySQL 8** for persistent, production-grade storage.

### pom.xml change
```xml
<!-- Removed -->
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
</dependency>

<!-- Added -->
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
</dependency>
```

### application.properties
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/tbibi?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD
spring.jpa.hibernate.ddl-auto=update
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
```

### GenerationType Fix
MySQL does not support Oracle-style SEQUENCES.
All 7 entities were changed from `GenerationType.SEQUENCE` → `GenerationType.IDENTITY`
(which uses MySQL's AUTO_INCREMENT).

### LocalDateTime Serialization Fix
Jackson was serializing `LocalDateTime` as an array `[2025,1,15,10,30]`.
Frontend `new Date()` could not parse this.
Fix:
```properties
spring.jackson.serialization.write-dates-as-timestamps=false
```
Now sends `"2025-01-15T10:30:00"` — standard ISO-8601 format.

---

## 5. JWT Authentication System

### Flow
```
1. User logs in → POST /api/auth/login
2. AuthService validates credentials (BCrypt)
3. JwtUtil.generateToken(user) creates a signed token
4. Token returned in LoginResponse.accessToken
5. Frontend saves: localStorage["tbibi_access_token"] = token
6. Every subsequent request: Authorization: Bearer <token>
7. JwtFilter intercepts request → validates token → sets SecurityContext
8. SecurityConfig enforces route permissions based on role
```

### Files

**`security/JwtUtil.java`**
- `generateToken(User)` — creates JWT with userId, email, role, 24h expiry (HMAC-SHA256)
- `validateToken(String)` — returns true/false
- `extractUserId(String)` — returns Long
- `extractRole(String)` — returns "PATIENT", "DOCTOR", or "ADMIN"

**`security/JwtFilter.java`**
- Extends `OncePerRequestFilter`
- Reads `Authorization: Bearer <token>` header
- Validates with JwtUtil
- Sets `SecurityContextHolder` authentication with `ROLE_<role>`

**`config/SecurityConfig.java`**
- Session: STATELESS (no HTTP sessions)
- Public routes: `/api/auth/**`, `/ws/**`, `/uploads/**`
- Admin only: `/api/admin/**`
- All others: `authenticated()`
- JwtFilter added before `UsernamePasswordAuthenticationFilter`

**`dto/LoginResponse.java`**
```java
private String accessToken;  // JWT token sent to frontend
```

### JWT Secret (application.properties)
```properties
app.jwt.secret=YOUR_JWT_SECRET_MIN_32_CHARS
app.jwt.expiration=86400000   # 24 hours in milliseconds
```

---

## 6. Backend Entities & Database Tables

### users
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| first_name | VARCHAR | NOT NULL |
| last_name | VARCHAR | NOT NULL |
| email | VARCHAR | UNIQUE, NOT NULL |
| password | VARCHAR | BCrypt hash |
| phone | VARCHAR | nullable |
| avatar_url | VARCHAR | nullable, HTTP URL |
| role | ENUM | PATIENT / DOCTOR / ADMIN |
| created_at | DATETIME | set on insert |
| updated_at | DATETIME | updated on save |

### doctor_profiles
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| user_id | BIGINT FK | → users.id (OneToOne) |
| specialty | VARCHAR | ex: "Cardiologue" |
| experience_years | INT | nullable |
| bio | VARCHAR(1000) | nullable |
| avatar_url | VARCHAR | nullable |
| verification_status | ENUM | PENDING / VERIFIED / REJECTED |

### appointments
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| patient_id | BIGINT FK | → users.id |
| doctor_id | BIGINT FK | → users.id |
| scheduled_at | DATETIME | must be in the future |
| reason | VARCHAR | nullable |
| status | ENUM | PENDING / CONFIRMED / CANCELLED |
| created_at | DATETIME | set on insert |

### chat_messages
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| sender_id | BIGINT FK | → users.id |
| receiver_id | BIGINT FK | → users.id |
| content | VARCHAR(2000) | NOT NULL |
| sent_at | DATETIME | set on insert |

### medical_files
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| patient_id | BIGINT FK | → users.id |
| uploaded_by_user_id | BIGINT FK | → users.id (nullable) |
| file_name | VARCHAR | original filename |
| content_type | VARCHAR | ex: "application/pdf" |
| storage_key | VARCHAR | disk path (not the file itself) |
| category | ENUM | REPORT / PRESCRIPTION / IMAGING / OTHER |
| created_at | DATETIME | set on insert |

### doctor_verification_docs
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| doctor_user_id | BIGINT FK | → users.id |
| doc_type | VARCHAR | "ID_CARD" / "DIPLOMA" / "LICENSE" |
| storage_key | VARCHAR | disk path |
| created_at | DATETIME | set on insert |

### subscriptions
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| code | ENUM | BASIC / PREMIUM (unique) |
| label | VARCHAR | "Essentiel" / "Premium" |
| price | DOUBLE | 60.0 / 90.0 |
| active | BOOLEAN | default true |

### user_subscriptions
| Field | Type | Notes |
|---|---|---|
| id | BIGINT PK | AUTO_INCREMENT |
| user_id | BIGINT FK | → users.id |
| subscription_id | BIGINT FK | → subscriptions.id |
| starts_at | DATETIME | NOT NULL |
| ends_at | DATETIME | nullable (null = no expiry) |
| status | VARCHAR | "ACTIVE" / "EXPIRED" / "CANCELED" |

---

## 7. API Endpoints Reference

### Auth (public — no token required)
```
POST /api/auth/register   → LoginResponse (includes accessToken)
POST /api/auth/login      → LoginResponse (includes accessToken)
```

### Account
```
GET  /api/account/me?userId=X          → AccountResponse
PUT  /api/account/me?userId=X          → AccountResponse (body: AccountResponse)
PUT  /api/account/password?userId=X    → "Password updated" (body: {currentPassword, newPassword})
```

### Doctors
```
GET  /api/doctors                      → List<DoctorResponse> (all VERIFIED)
GET  /api/doctors?specialty=Cardiologue → List<DoctorResponse> (filtered)
GET  /api/doctors/{id}                 → DoctorResponse (id = User.id)
```

### Appointments
```
POST /api/appointments                         → AppointmentResponse
  body: { patientId, doctorId, scheduledAt, reason }
  scheduledAt format: "2024-01-15T10:30:00" (ISO-8601)

GET  /api/appointments/patient/{patientId}     → List<AppointmentResponse>
GET  /api/appointments/doctor/{doctorId}       → List<AppointmentResponse>
PUT  /api/appointments/{id}/status             → AppointmentResponse
  body: { "status": "CONFIRMED" | "CANCELLED" }
```

### Chat
```
WebSocket: SockJS connect to http://localhost:8084/ws
  Subscribe: /topic/chat.{userId}
  Send:      /app/chat  body: { senderId, receiverId, content }

GET /api/chats/{partnerId}/messages?userId=X   → List<ChatMessageResponse>
```

### Medical Files
```
GET    /api/patients/{id}/medical-files                      → List<MedicalFileResponse>
POST   /api/patients/{id}/medical-files                      → MedicalFileResponse
  multipart: file, category (REPORT|PRESCRIPTION|IMAGING|OTHER)
GET    /api/patients/{id}/medical-files/{fileId}/download    → file bytes
DELETE /api/patients/{id}/medical-files/{fileId}             → "File deleted"
```

### Nearby Medical (Healthsites.io)
```
GET /api/nearby-medical?lat=36.8&lng=10.1&radius=3000
→ [ { name, type, lat, lon, street, city, distance } ]
```

### AI Assistant (Groq)
```
POST /api/assistant/chat
  body: { "message": "J'ai mal à la tête" }
  → { "reply": "..." }
```

### Subscriptions & Payment (Stripe)
```
GET  /api/subscriptions                    → List<Subscription>
POST /api/subscriptions/checkout-session
  body: { "planCode": "BASIC" | "PREMIUM" }
  → { "checkoutUrl": "https://checkout.stripe.com/..." }
```

### Uploads
```
POST /api/uploads/avatar
  multipart: userId, avatar
  → { "avatarUrl": "http://localhost:8084/uploads/avatars/user_X.jpg" }

POST /api/uploads/doctor-docs
  multipart: doctorId, idCard, diploma, license (all optional)
  → { "message": "Documents uploaded successfully" }
```

### Admin (ROLE_ADMIN only)
```
GET    /api/admin/stats                      → { totalUsers, totalPatients, totalDoctors, pendingDoctors }
GET    /api/admin/users                      → List<AdminUserResponse>
GET    /api/admin/users/role/{role}          → List<AdminUserResponse>
DELETE /api/admin/users/{id}                 → { "message": "..." } (cascade delete)
GET    /api/admin/doctors/pending            → List<AdminUserResponse>
PUT    /api/admin/doctors/{id}/verify        → { "message": "Médecin vérifié" }
PUT    /api/admin/doctors/{id}/reject        → { "message": "Médecin rejeté" }
```

---

## 8. All Backend Fixes Applied

### Critical Bug Fixes

| # | File | Bug | Fix |
|---|---|---|---|
| 1 | `AccountService.java` | `new BCryptPasswordEncoder()` created a standalone instance instead of using the Spring bean | Changed to inject `PasswordEncoder` via `@RequiredArgsConstructor` |
| 2 | `DoctorService.mapToResponse()` | `id = profile.getId()` (DoctorProfile ID) — caused appointments and chat to fail with wrong user | Changed to `id = profile.getUser().getId()` (User ID) |
| 3 | `AppointmentController.book()` | No validation on past dates | Added `scheduledAt.isBefore(LocalDateTime.now())` check |
| 4 | `AdminController.deleteUser()` | Only deleted DoctorProfile before user → FK constraint crash | Added full cascade: appointments → chat → subscriptions → docs → profile → user |
| 5 | All 7 entities | `GenerationType.SEQUENCE` crashes on MySQL | Changed to `GenerationType.IDENTITY` (AUTO_INCREMENT) |
| 6 | `AuthService` | Used `new BCryptPasswordEncoder()` instead of injected bean | Fixed to use `PasswordEncoder` Spring bean |
| 7 | `UploadController` | Hardcoded `"http://localhost:8084"` URL | Replaced with `@Value("${app.server.base-url}")` |
| 8 | `AdminController.getPendingDoctors()` | Loaded ALL doctors then filtered in memory | Changed to `findByVerificationStatus(PENDING)` direct query |
| 9 | `DoctorService.getDoctorsBySpecialty()` | Showed PENDING and REJECTED doctors to patients | Added `findBySpecialtyAndVerificationStatus(specialty, VERIFIED)` |
| 10 | `NearbyService` | Declared `@Value mapApiKey` field that was never used | Removed unused field and `@Value` annotation |

### Performance Improvements

| File | Before | After |
|---|---|---|
| `AdminController.getStats()` | `findByRole(PATIENT).size()` — loads all users into memory | `countByRole(PATIENT)` — single SQL `COUNT(*)` |
| `AdminController.getStats()` | `findAll().stream().filter().count()` for pending doctors | `countByVerificationStatus(PENDING)` — single SQL |
| `AdminController.getPendingDoctors()` | `findAll()` then stream filter | `findByVerificationStatus(PENDING)` |

### Dead Code Removed

| File | Removed |
|---|---|
| `NearbyService.java` | `@Value("${app.map.api-key}") private String mapApiKey` — declared, never used |
| `DoctorVerificationDocRepository` | `existsByDoctorAndDocType()` — never called |
| `MedicalFileRepository` | `findByPatientAndCategory()` — never called |
| `DoctorProfileRepository` | `existsByUser()` — never called |
| `UserSubscriptionRepository` | `existsByUserAndStatus()` — never called |
| `application.properties` | `app.map.api-key` — replaced by `app.healthsites.api-key` |

### Comment Corrections
All comments saying "Oracle" were updated to "MySQL" across:
- `User.java`, `MedicalFile.java`, `DoctorVerificationDoc.java`
- `MedicalFileService.java`, `AccountService.java`

Stale TODO comment removed from `AccountController.java`:
```java
// REMOVED: "later we will replace this with JWT token" — JWT is already done
```

---

## 9. External API Integrations

### Groq AI (LLaMA 3.3-70b)
- **Provider**: Groq (free tier, OpenAI-compatible)
- **Model**: `llama-3.3-70b-versatile`
- **Used by**: `AssistantService.java` via Spring AI `ChatClient`
- **Endpoint**: `POST /api/assistant/chat`
- **System prompt**: Medical assistant for Tunisia, responds in French/Arabic/English

```properties
spring.ai.openai.api-key=gsk_...
spring.ai.openai.base-url=https://api.groq.com/openai
spring.ai.openai.chat.options.model=llama-3.3-70b-versatile
```

### Healthsites.io (replaced Overpass API)
- **Was**: Overpass API (OpenStreetMap raw query, no key needed)
- **Now**: Healthsites.io REST API (curated health facilities database)
- **Why changed**: Better data quality, dedicated healthcare database, user has an account
- **Endpoint used**: `GET https://healthsites.io/api/v3/facilities/`
- **Auth**: `api-key` query parameter
- **Search method**: Bounding box (`extent=minLng,minLat,maxLng,maxLat`)
  - Bounding box calculated from lat/lng + radius using 1° ≈ 111,320m formula
- **Response fields used**: `attributes.name`, `attributes.amenity`, `attributes.healthcare`, `attributes.addr_street`, `attributes.addr_city`, `centroid.coordinates[0]` (lng), `centroid.coordinates[1]` (lat)

```properties
app.healthsites.api-key=ca46295630218ee595c794424e577c40a4f51db0
```

### Stripe
- **Mode**: Test mode
- **Flow**: Frontend → `POST /api/subscriptions/checkout-session` → backend creates Stripe session → returns `checkoutUrl` → frontend redirects to Stripe
- **Plans**: BASIC (60 DT / $60), PREMIUM (90 DT / $90)
- **Success URL**: `http://localhost:5500/html/main.html`
- **Cancel URL**: `http://localhost:5500/html/paiement.html`

---

## 10. Data Seeder — Default Accounts

On every backend startup, `DataSeeder.java` (implements `CommandLineRunner`) seeds:

### Admin Account
| Field | Value |
|---|---|
| Email | `admin@tbibi.tn` |
| Password | `Admin123` |
| Role | ADMIN |

### 5 Pre-verified Doctors
| Name | Email | Specialty | Experience |
|---|---|---|---|
| Dr. Sami Ben Ali | sami.benali@tbibi.tn | Cardiologue | 12 ans |
| Dr. Ines Mansouri | ines.mansouri@tbibi.tn | Pédiatre | 8 ans |
| Dr. Karim Trabelsi | karim.trabelsi@tbibi.tn | Dermatologue | 15 ans |
| Dr. Fatma Chaabane | fatma.chaabane@tbibi.tn | Gynécologue | 10 ans |
| Dr. Mourad Jebali | mourad.jebali@tbibi.tn | Médecin Généraliste | 6 ans |

All doctors: password = `Doctor123`, status = VERIFIED

### Subscription Plans
| Code | Label | Price |
|---|---|---|
| BASIC | Essentiel | 60.0 |
| PREMIUM | Premium | 90.0 |

---

## 11. Frontend Structure

```
front/
├── html/
│   ├── index.html         → Landing page
│   ├── login.html         → Login form
│   ├── signup.html        → Registration form (PATIENT or DOCTOR)
│   ├── main.html          → Main dashboard (PATIENT + DOCTOR)
│   ├── admin.html         → Admin panel (ADMIN only)
│   ├── manage-account.html → Profile settings
│   ├── assistant.html     → AI assistant chat page
│   └── paiement.html      → Subscription payment page
├── js/
│   ├── login-page.js      → Login form → JWT → localStorage → route by role
│   ├── signup.js          → Registration form → POST /api/auth/register
│   ├── dashboard-page.js  → Main dashboard (patient mode + doctor mode)
│   ├── admin-page.js      → Admin panel (stats, verify doctors, delete users)
│   ├── manage-account-page.js → Profile + password + avatar upload
│   ├── assistant-chat.js  → AI chat UI → POST /api/assistant/chat
│   ├── paiement-page.js   → Stripe checkout flow
│   └── scripts.js         → Shared utilities
├── css/
│   ├── main.css
│   ├── stylelogin.css
│   ├── stylesignup.css
│   ├── stylepaiement.css
│   ├── styleindex.css
│   └── modpass.css
└── assets/
    ├── logo.jpg
    └── background.jpg
```

### Key Frontend Patterns

**JWT in every request** (`apiFetch` helper):
```javascript
const token = localStorage.getItem('tbibi_access_token');
headers: { Authorization: 'Bearer ' + token }
```

**Session object** in localStorage (`tbibi_user`):
```json
{
  "id": 3,
  "firstName": "Ahmed",
  "lastName": "Ben Salah",
  "email": "ahmed@test.com",
  "role": "PATIENT",
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "subscriptionCode": "BASIC",
  "subscriptionStatus": "ACTIVE"
}
```

**Role-based routing** after login:
- `ADMIN` → `admin.html`
- `DOCTOR` → `main.html`
- `PATIENT` → `main.html`

---

## 12. Role Capabilities

### PATIENT
- Register with subscription plan (BASIC or PREMIUM)
- Browse verified doctors (filter by specialty)
- View doctor profiles (bio, experience, specialty)
- Book appointments (future dates only)
- View their appointment history
- Real-time chat with their doctor
- AI medical assistant (symptom guidance)
- Upload and manage medical files (PDF, images)
- Find nearby pharmacies / hospitals / clinics on map
- Update profile, change password, upload avatar
- Pay via Stripe for subscription plan

### DOCTOR
- Register (requires document upload: ID, diploma, license)
- Wait for admin verification (status: PENDING → VERIFIED)
- View all appointments booked with them
- Confirm or cancel appointments (PENDING → CONFIRMED or CANCELLED)
- Chat in real-time with patients
- Upload/update profile photo
- Update bio, specialty, experience

### ADMIN
- Access admin dashboard only (no patient/doctor features)
- View platform statistics (total users, patients, doctors, pending)
- View list of doctors awaiting verification
- Approve (VERIFY) or reject doctors
- View all users by role
- Delete any user (full cascade delete — all related data removed)

---

## 13. Removed Features

### Consultation Vidéo — Future Feature

The "Consultation Vidéo" button was **removed from the frontend** because:
- No WebRTC implementation exists
- No signaling server
- No `getUserMedia()` calls
- It was just a stub showing an `alert()`

**For the rapport and presentation**: mention "Consultation Vidéo via WebRTC" as a **planned future feature** in the Perspectives/Améliorations section. Technology: WebRTC + STUN/TURN server + WebSocket signaling.

---

## 14. File Structure

```
Tbibi votre clinic virtuelle/
├── tbibi-backend/
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/aziz/tbibi/tbibi_backend/
│       │   ├── TbibiBackendApplication.java
│       │   ├── config/
│       │   │   ├── ChatClientConfig.java      → Spring AI ChatClient bean
│       │   │   ├── CorsConfig.java            → CORS for /api/** and /ws/**
│       │   │   ├── DataSeeder.java            → Seeds admin + 5 doctors on startup
│       │   │   ├── GlobalExceptionHandler.java → Returns JSON errors (400/500)
│       │   │   ├── SecurityConfig.java        → JWT + route permissions
│       │   │   └── WebSocketConfig.java       → STOMP + SockJS on /ws
│       │   ├── controllers/
│       │   │   ├── AdminController.java
│       │   │   ├── AppointmentController.java
│       │   │   ├── AssistantController.java
│       │   │   ├── AuthController.java
│       │   │   ├── AccountController.java
│       │   │   ├── ChatController.java
│       │   │   ├── DoctorController.java
│       │   │   ├── MedicalFileController.java
│       │   │   ├── NearbyController.java
│       │   │   ├── SubscriptionController.java
│       │   │   └── UploadController.java
│       │   ├── dto/                           → Request/Response objects
│       │   ├── entities/                      → JPA entities (8 tables)
│       │   ├── enums/                         → Role, VerificationStatus, etc.
│       │   ├── repositories/                  → Spring Data JPA interfaces
│       │   ├── security/
│       │   │   ├── JwtFilter.java
│       │   │   └── JwtUtil.java
│       │   └── services/
│       │       ├── AccountService.java
│       │       ├── AssistantService.java
│       │       ├── AuthService.java
│       │       ├── DoctorService.java
│       │       ├── MedicalFileService.java
│       │       └── NearbyService.java
│       └── resources/
│           └── application.properties
└── front/
    ├── html/
    ├── js/
    ├── css/
    └── assets/
```

---

## Notes for Soutenance (Presentation)

- **Database**: MySQL 8 (not H2, not Oracle)
- **Port**: 8084
- **Auth**: JWT (stateless, 24h expiry)
- **Password**: BCrypt (industry standard, cannot be reversed)
- **AI**: Groq API — LLaMA 3.3-70b model (French/Arabic/English)
- **Map**: Healthsites.io API (your account: azizbelghaieb)
- **Chat**: WebSocket STOMP (real-time, no polling)
- **Video consultation**: NOT implemented — mention as future feature (WebRTC)
- **Methodology**: SCRUM / Agile — 7 sprints

---

*Generated from full project engineering session — April 2026*
