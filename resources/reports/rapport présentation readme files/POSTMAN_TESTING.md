# TBIBI Backend — Postman Testing Documentation

**Project:** Tbibi — Votre Clinique Virtuelle
**Backend:** Spring Boot 3.5.13 · Java 21 · H2 In-Memory Database
**Base URL:** `http://localhost:8084`
**Date:** 2026-04-11
**Tests Passed:** 18 / 19 (1 skipped — WebSocket, tested from frontend)

---

## How to Run the Backend

1. Open the project in IntelliJ IDEA
2. Run `TbibiBackendApplication.java`
3. Wait for the console to show `Started TbibiBackendApplication`
4. The DataSeeder automatically creates:
   - 1 Admin account: `admin@tbibi.tn` / `Admin123`
   - 3 Subscription plans: BASIC, PREMIUM, ENTERPRISE
   - 5 verified doctors (for testing)

> **Note:** H2 is an in-memory database. All data is lost on restart. The DataSeeder re-seeds on every startup.

---

## Test Results

---

### TEST 1 — Get Subscription Plans

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/subscriptions` |
| Body | None |
| Status | **PASSED** |

**Expected Response:**
```json
[
  { "id": 1, "code": "BASIC", "price": 0.0, ... },
  { "id": 2, "code": "PREMIUM", "price": 29.99, ... },
  { "id": 3, "code": "ENTERPRISE", "price": 99.99, ... }
]
```

---

### TEST 2 — Register a Patient

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/auth/register` |
| Body | raw JSON |
| Status | **PASSED** |

**Request Body:**
```json
{
  "firstName": "Ahmed",
  "lastName": "Ben Ali",
  "email": "ahmed@test.com",
  "password": "Test123!",
  "phone": "22334455",
  "role": "PATIENT",
  "subscriptionCode": "BASIC"
}
```

**Expected Response:**
```json
{
  "id": 7,
  "email": "ahmed@test.com",
  "role": "PATIENT",
  "subscriptionStatus": "ACTIVE"
}
```

---

### TEST 3 — Login as Patient

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/auth/login` |
| Body | raw JSON |
| Status | **PASSED** |

**Request Body:**
```json
{
  "email": "ahmed@test.com",
  "password": "Test123!"
}
```

**Expected Response:**
```json
{
  "id": 7,
  "email": "ahmed@test.com",
  "role": "PATIENT",
  "subscriptionStatus": "ACTIVE"
}
```

---

### TEST 4 — Register a Doctor

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/auth/register` |
| Body | raw JSON |
| Status | **PASSED** |

**Request Body:**
```json
{
  "firstName": "Sami",
  "lastName": "Trabelsi",
  "email": "sami@doctor.com",
  "password": "Doc123!",
  "phone": "55667788",
  "role": "DOCTOR",
  "subscriptionCode": "PREMIUM",
  "specialty": "Cardiologue",
  "experienceYears": 10,
  "bio": "Cardiologue expérimenté à Tunis"
}
```

**Expected Response:** User object with `role: DOCTOR`, doctor profile created with `verificationStatus: PENDING`

---

### TEST 5 — Get All Doctors

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/doctors` |
| Body | None |
| Status | **PASSED** |

**Expected Response:** Array of doctor objects with profile info (specialty, verificationStatus, etc.)

---

### TEST 6 — Get Doctor by ID

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/doctors/2` |
| Body | None |
| Status | **PASSED** |

**Expected Response:** Single doctor object with full profile details

---

### TEST 7 — Login as Admin

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/auth/login` |
| Body | raw JSON |
| Status | **PASSED** |

**Request Body:**
```json
{
  "email": "admin@tbibi.tn",
  "password": "Admin123"
}
```

**Expected Response:**
```json
{
  "id": 1,
  "email": "admin@tbibi.tn",
  "role": "ADMIN"
}
```

---

### TEST 8 — Get Pending Doctors (Admin)

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/admin/doctors/pending` |
| Body | None |
| Status | **PASSED** |

**Expected Response:** Array of doctors with `verificationStatus: PENDING`

> **Fix Applied:** AuthService was not creating DoctorProfile on registration. Fixed by injecting `DoctorProfileRepository` and creating the profile automatically when a DOCTOR registers.

---

### TEST 9 — Verify a Doctor (Admin)

| Field | Value |
|-------|-------|
| Method | PUT |
| URL | `http://localhost:8084/api/admin/doctors/{id}/verify` |
| Body | None |
| Status | **PASSED** |

**Expected Response:** Updated doctor profile with `verificationStatus: VERIFIED`

---

### TEST 10 — Book an Appointment

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/appointments` |
| Body | raw JSON |
| Status | **PASSED** |

**Request Body:**
```json
{
  "patientId": 8,
  "doctorId": 7,
  "scheduledAt": "2026-04-15T10:00:00",
  "reason": "Consultation cardiologique"
}
```

**Expected Response:**
```json
{
  "id": 1,
  "patientId": 8,
  "doctorId": 7,
  "status": "PENDING",
  "scheduledAt": "2026-04-15T10:00:00"
}
```

> **Fix Applied:** The entire Appointment feature was missing. Created `Appointment.java` entity, `AppointmentRepository.java`, `AppointmentRequest.java` DTO, `AppointmentResponse.java` DTO, and `AppointmentController.java` from scratch.

---

### TEST 11 — Get Appointments for Patient

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/appointments/patient/{patientId}` |
| Body | None |
| Status | **PASSED** |

**Expected Response:** Array of appointment objects for that patient

---

### TEST 12 — Update Appointment Status

| Field | Value |
|-------|-------|
| Method | PUT |
| URL | `http://localhost:8084/api/appointments/{id}/status` |
| Body | raw JSON |
| Status | **PASSED** |

**Request Body:**
```json
{
  "status": "CONFIRMED"
}
```

**Expected Response:** Updated appointment with `status: CONFIRMED`

---

### TEST 13 — Upload Patient Avatar

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/users/{id}/avatar` |
| Body | form-data, key=`file`, type=File |
| Status | **PASSED** |

**Expected Response:**
```json
{
  "message": "Avatar uploaded successfully",
  "avatarUrl": "/uploads/avatars/..."
}
```

---

### TEST 14 — Upload Patient Prescriptions

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/users/{id}/prescriptions` |
| Body | form-data, key=`files`, type=File (multiple) |
| Status | **PASSED** |

**Expected Response:**
```json
{
  "message": "Files uploaded successfully",
  "urls": ["/uploads/prescriptions/..."]
}
```

---

### TEST 15 — Upload Doctor Documents

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/doctors/{id}/documents` |
| Body | form-data, key=`files`, type=File (multiple) |
| Status | **PASSED** |

**Expected Response:**
```json
{
  "message": "Documents uploaded successfully",
  "urls": ["/uploads/documents/..."]
}
```

---

### TEST 16 — AI Assistant Chat

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `http://localhost:8084/api/assistant/chat` |
| Body | raw JSON |
| Status | **PASSED** |

**Request Body:**
```json
{
  "message": "J'ai mal à la tête depuis 3 jours, que faire ?"
}
```

**Expected Response:**
```json
{
  "response": "Je suis désolé d'apprendre que vous souffrez de maux de tête..."
}
```

> **Fix Applied:** Google Gemini API had quota=0 on all keys. Switched entirely to **Groq** (free, OpenAI-compatible). Updated `pom.xml` dependency from `spring-ai-starter-model-google-genai` to `spring-ai-starter-model-openai`. Updated `application.properties` with Groq base URL and model `llama-3.3-70b-versatile`.

---

### TEST 17 — Find Nearby Medical Places

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/nearby-medical?lat=36.8065&lng=10.1815&radius=2000` |
| Body | None |
| Status | **PASSED** |

**Expected Response:** Array of nearby pharmacies, clinics, hospitals within 2km radius

**Sample Result:**
```json
[
  { "name": "Pharmacie du Parc", "type": "Pharmacie", "distance": 375, "lat": 36.8058989, "lon": 10.1773572 },
  { "name": "Dr. Guermassi Khaled", "type": "Cabinet médical", "distance": 438 }
]
```

> **Fix Applied:** The test URL was `/api/map/nearby` but the actual controller mapping is `/api/nearby-medical`.

---

### TEST 18 — Get Chat Messages (WebSocket)

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/chats/{chatId}/messages?userId={userId}` |
| Status | **SKIPPED** |

> **Reason:** The chat system uses WebSocket (STOMP protocol). Chats are created when users connect and exchange messages from the frontend. This endpoint returns messages for an existing chat — it requires an active WebSocket session to first exist. Will be tested from the frontend.
>
> **WebSocket endpoint:** `ws://localhost:8084/ws`
> **Subscribe to:** `/topic/chat/{chatId}`
> **Send to:** `/app/chat/{chatId}`

---

### TEST 19 — Admin Dashboard Stats

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `http://localhost:8084/api/admin/stats` |
| Body | None |
| Status | **PASSED** |

**Expected Response:**
```json
{
  "totalUsers": 7,
  "totalDoctors": 5,
  "totalPatients": 1,
  "pendingDoctors": 0
}
```

---

## Fixes Applied During Testing

| # | Problem | Fix |
|---|---------|-----|
| 1 | GET /api/subscriptions → 500 | Added GET endpoint to SubscriptionController |
| 2 | GET /api/admin/doctors/pending → empty | AuthService never created DoctorProfile on register — fixed |
| 3 | RegisterRequest missing doctor fields | Added `specialty`, `experienceYears`, `bio` to RegisterRequest |
| 4 | POST /api/appointments → 500 | Entire feature missing — created entity, repo, DTOs, controller |
| 5 | AI assistant → Gemini quota 0 | Switched from Google Gemini to Groq (llama-3.3-70b-versatile) |
| 6 | GET /api/map/nearby → 500 | Wrong URL — actual mapping is `/api/nearby-medical` |
| 7 | AppointmentStatus enum was empty | Filled enum: PENDING, CONFIRMED, CANCELLED, COMPLETED |

---

## Backend Capabilities Summary

| Feature | Endpoint | Notes |
|---------|----------|-------|
| Subscriptions | GET /api/subscriptions | 3 plans seeded |
| Auth Register | POST /api/auth/register | PATIENT and DOCTOR roles |
| Auth Login | POST /api/auth/login | Returns user + role |
| Doctors List | GET /api/doctors | All verified doctors |
| Doctor Detail | GET /api/doctors/{id} | Full profile |
| Appointments | POST/GET/PUT /api/appointments | Book, view, update status |
| File Uploads | POST /api/users/{id}/avatar | Avatar upload |
| Prescriptions | POST /api/users/{id}/prescriptions | Multi-file upload |
| Doctor Docs | POST /api/doctors/{id}/documents | Verification documents |
| AI Assistant | POST /api/assistant/chat | Powered by Groq llama-3.3-70b |
| Nearby Medical | GET /api/nearby-medical | Real map data via Healthcareio API |
| WebSocket Chat | ws://localhost:8084/ws | STOMP, real-time messaging |
| Admin Users | GET /api/admin/users | All users list |
| Admin Stats | GET /api/admin/stats | Dashboard numbers |
| Admin Verify | PUT /api/admin/doctors/{id}/verify | Approve doctor |
| Admin Reject | PUT /api/admin/doctors/{id}/reject | Reject doctor |
| Admin Delete | DELETE /api/admin/users/{id} | Remove user |

---

*Generated after completing all backend Postman tests — TBIBI Project 2026*
