# TBIBI Frontend Wiring Guide

This document explains how the current frontend is structured and how to wire it to the backend cleanly.

## 1) Frontend Structure

The project is organized by responsibility:

- `html/`: page templates.
- `css/`: page styles.
- `js/`: page logic and backend integration.
- `assets/`: images and static assets.

Current page-to-script mapping:

| Page | Script | Main role |
|---|---|---|
| `html/index.html` | none | Landing page, pricing, CTA to auth flow |
| `html/login.html` | `js/login-page.js` | Login and optional subscription context forwarding |
| `html/signup.html` | `js/signup.js` | Registration, role-specific files, plan selection |
| `html/paiement.html` | `js/paiement-page.js` | Checkout session creation and payment redirect |
| `html/password-reset.html` | `js/password-reset-page.js` | Forgot-password request |
| `html/main.html` | `js/dashboard-page.js` | Doctors, chat, medical files, nearby services, emergency modal |
| `html/manage-account.html` | `js/manage-account-page.js` | Profile, subscription, password update |
| `html/assistant.html` | `js/assistant-chat.js` | AI assistant chat endpoint integration |

## 2) Shared Runtime Contract

All JS modules expect the same runtime conventions.

### API base URL

Each module uses:

```js
const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8080';
```

If you deploy to another backend host, define `window.TBIBI_API_BASE` before page scripts.

Example include (place before page JS):

```html
<script>
  window.TBIBI_API_BASE = 'https://your-domain.com/api';
</script>
```

### Local storage keys

- `tbibi_access_token`
- `tbibi_refresh_token`
- `tbibi_user`
- (optional legacy/extra) `tbibi_session`

Any page that calls protected endpoints sends:

```http
Authorization: Bearer <tbibi_access_token>
```

Pages clear session and redirect to login on 401.

## 3) User Flow Wiring

Primary flow in the current frontend:

1. Landing: `index.html`
2. Login: `login.html`
3. Signup (if needed): `signup.html`
4. Payment: `paiement.html`
5. App: `main.html`
6. Account management: `manage-account.html`
7. Assistant: `assistant.html`

Subscription context is passed by query params:

- `?plan=basic|premium`
- `?price=<number>`

Used by:

- `login-page.js` (forwards plan/price to signup and payment)
- `signup.js` (redirects to payment with chosen plan)
- `paiement-page.js` (displays plan and sends checkout request)

## 4) Backend API Endpoints Needed

The frontend currently calls these endpoints.

### Auth

- `POST /api/auth/login`
  - request: `{ email, password }`
  - expected response: `{ accessToken, refreshToken, user }`
- `POST /api/auth/register`
  - request: `multipart/form-data`
  - fields:
    - always: `firstName`, `lastName`, `phone`, `email`, `password`, `role`, `subscriptionPlan`, `termsAccepted`
    - doctor: `doctorIdDocument`, `doctorDiplomaDocument`, `doctorLicenseDocument`
    - patient (optional): repeated `medicalFiles`
- `POST /api/auth/forgot-password`
  - request: `{ email }`

### Subscriptions / Payment

- `POST /api/subscriptions/checkout-session`
  - request: `{ planCode, amountHint, currency }`
  - expected response: one of:
    - `{ checkoutUrl: "..." }`
    - `{ redirectUrl: "..." }`
    - or no URL, then frontend falls back to `main.html`
- `GET /api/subscriptions/me`
  - used in account page

### Users

- `GET /api/account/me`
- `PUT /api/account/me`
  - request: `{ firstName, lastName, phone, specialty, bio }`
- `PUT /api/account/me/password`
  - request: `{ currentPassword, newPassword }`

### Doctors / Chat

- `GET /api/doctors`
  - expected doctor fields (supports aliases):
    - `id`, `firstName|givenName`, `lastName|familyName`, `specialty|speciality`, `experienceYears|yearsOfExperience`, `bio|description`, `isOnline`, `avatarUrl|avatar`
- `GET /api/chats/{doctorId}/messages`
- `POST /api/chats/{doctorId}/messages`
  - request: `{ content }`

### Medical Files

- `GET /api/patients/{id}/medical-files`
  - expected item aliases supported by frontend:
    - `id`, `originalFileName|fileName|name`, `createdAt|uploadedAt`
- `POST /api/patients/{id}/medical-files`
  - request: `multipart/form-data` with repeated `files`
- `GET /api/patients/{id}/medical-files/{fileId}/download`
  - returns file blob

### Assistant

- `POST /api/assistant/chat`
  - request: `{ message }`
  - expected response: `{ reply }` or `{ message }`

## 5) Per-Page Wiring Notes

### `login-page.js`

- Reads optional `plan` and `price` from URL.
- On success stores token(s) and user in localStorage.
- Redirects:
  - with plan context -> `paiement.html?...`
  - otherwise -> `main.html`

### `signup.js`

- Client-side validation for names, phone format (`+216 ...`), passwords, role.
- Doctor role requires 3 files and modal validation.
- Sends multipart request to register endpoint.
- Redirects to payment page with selected plan and resolved price.

### `paiement-page.js`

- Displays selected plan/amount from query string.
- Performs card-input UX formatting only (not real card processing in frontend).
- Calls backend checkout-session endpoint and redirects to provider URL.

### `dashboard-page.js`

- Uses authenticated `apiFetch` wrapper.
- Loads doctors and medical file list in parallel.
- Supports:
  - doctor profile panel
  - chat send/receive
  - medical file upload/list/view
  - nearby services via geolocation + Overpass API
  - emergency modal

### `manage-account-page.js`

- Loads profile (`/users/me`) and subscription (`/subscriptions/me`).
- Updates profile and password.
- Handles 401 by clearing session and redirecting to login.

### `assistant-chat.js`

- Sends user prompt to `/assistant/message`.
- Appends user + bot messages in stream.

## 6) Deployment Wiring Checklist

Use this checklist to connect everything end-to-end:

1. Serve static frontend so paths resolve consistently (same host or CDN).
2. Set `window.TBIBI_API_BASE` for each environment (dev/staging/prod).
3. Enable CORS on backend for frontend origin, including `Authorization` header.
4. Ensure login returns `accessToken` and optionally `refreshToken` exactly as expected.
5. Ensure protected routes accept bearer token.
6. Implement all endpoint paths listed above with compatible payload shapes.
7. Verify redirect URLs returned by checkout endpoint are absolute and reachable.
8. Confirm file upload limits and MIME support (`pdf`, `jpg`, `jpeg`, `png`, `dcm`).
9. Verify 401 behavior: frontend should always clear session and redirect to login.
10. Test full flow: signup -> payment -> dashboard -> account update -> assistant.

## 7) Known Frontend Observations

- In `html/paiement.html`, the "Accueil" link currently points to `../index.html`. Given current structure (`html/index.html`), this may need to be `index.html`.
- `tbibi_session` is cleared in some pages but not actively set in current scripts.

## 8) Suggested Next Improvements

1. Create one shared `api-client.js` used by all pages (single source for headers, 401 handling, JSON parsing).
2. Create one shared `auth-storage.js` for token/user read-write-clear helpers.
3. Add a single environment bootstrap file (`js/config.js`) to define API base by environment.
4. Add smoke tests for the critical path (login, signup, checkout redirect, doctors load, chat send).
