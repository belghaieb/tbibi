// ─────────────────────────────────────────────────────────────
// admin-page.js — TBIBI Admin Dashboard
//
// Wires admin.html to the Spring backend admin API endpoints:
//   GET  /api/admin/stats                → dashboard stat cards
//   GET  /api/admin/doctors/pending      → pending verification list
//   PUT  /api/admin/doctors/{id}/verify  → approve a doctor
//   PUT  /api/admin/doctors/{id}/reject  → reject a doctor
//   GET  /api/admin/users                → full user list
//   DELETE /api/admin/users/{id}         → delete a user account
// ─────────────────────────────────────────────────────────────

const API_BASE_URL     = window.TBIBI_API_BASE || 'http://localhost:8084/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';

// ── State ────────────────────────────────────────────────────
let allUsersCache = []; // full user list used for client-side search filtering

// ── Auth helpers ──────────────────────────────────────────────

function clearSession() {
    localStorage.clear();
}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('tbibi_user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

// Generic fetch wrapper — adds Authorization header automatically.
// Redirects to login on 401 (expired/missing token).
async function apiFetch(path, options = {}) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
    const headers = {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {})
    };
    const response = await fetch(API_BASE_URL + path, Object.assign({}, options, { headers }));
    if (response.status === 401) {
        clearSession();
        window.location.href = 'login.html';
        return null;
    }
    return response;
}

// ── Toast notification ────────────────────────────────────────
function showAdminNotice(message) {
    const el   = document.getElementById('admin-toast');
    const body = document.getElementById('admin-toast-body');
    if (!el || !body) return;
    body.textContent = message;
    bootstrap.Toast.getOrCreateInstance(el, { delay: 4000 }).show();
}

// ── Confirm modal ─────────────────────────────────────────────
// Opens a modal asking the user to confirm a dangerous action.
// onConfirm is called only if the user clicks OK.
function showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').textContent  = message;

    const okBtn = document.getElementById('confirm-modal-ok');

    // Remove any previous listener so it doesn't fire twice
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('confirmModal'));

    newOkBtn.addEventListener('click', function() {
        modal.hide();
        onConfirm();
    });

    modal.show();
}

// ══════════════════════════════════════════════════════════════
//  STATS — Dashboard cards
// ══════════════════════════════════════════════════════════════

// Fetches totals from /api/admin/stats and renders four stat cards.
async function loadStats() {
    const row = document.getElementById('stats-row');
    if (!row) return;

    const response = await apiFetch('/admin/stats', { method: 'GET' });
    if (!response) return;

    const data = await response.json().catch(function() { return {}; });
    if (!response.ok) {
        row.innerHTML = '<div class="col-12"><div class="alert alert-danger">' + (data.message || 'Impossible de charger les statistiques.') + '</div></div>';
        return;
    }

    // Four cards: total users, total doctors, total patients, pending doctors
    var cards = [
        {
            value: data.totalUsers    || 0,
            label: 'Utilisateurs total',
            icon:  'bi-people-fill',
            color: 'bg-primary-subtle text-primary'
        },
        {
            value: data.totalDoctors  || 0,
            label: 'Médecins',
            icon:  'bi-heart-pulse-fill',
            color: 'bg-success-subtle text-success'
        },
        {
            value: data.totalPatients || 0,
            label: 'Patients',
            icon:  'bi-person-fill',
            color: 'bg-info-subtle text-info'
        },
        {
            value: data.pendingDoctors || 0,
            label: 'Vérifications en attente',
            icon:  'bi-hourglass-split',
            color: 'bg-warning-subtle text-warning'
        }
    ];

    row.innerHTML = cards.map(function(card) {
        return (
            '<div class="col-sm-6 col-xl-3">' +
                '<div class="stat-card d-flex align-items-center gap-3">' +
                    '<div class="stat-icon ' + card.color + '">' +
                        '<i class="bi ' + card.icon + '"></i>' +
                    '</div>' +
                    '<div>' +
                        '<div class="stat-value">' + card.value + '</div>' +
                        '<div class="stat-label">' + card.label + '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }).join('');

    // Update the pending badge in the tab header
    const badge = document.getElementById('pending-count-badge');
    if (badge) badge.textContent = data.pendingDoctors || 0;
}

// ══════════════════════════════════════════════════════════════
//  PENDING DOCTORS — Verification queue
// ══════════════════════════════════════════════════════════════

// Fetches doctors with verificationStatus=PENDING from /api/admin/doctors/pending.
async function loadPendingDoctors() {
    const container = document.getElementById('pending-table-container');
    if (!container) return;

    container.innerHTML = '<div class="text-muted small">Chargement...</div>';

    const response = await apiFetch('/admin/doctors/pending', { method: 'GET' });
    if (!response) return;

    const data = await response.json().catch(function() { return []; });
    if (!response.ok) {
        container.innerHTML = '<div class="alert alert-danger">' + (data.message || 'Erreur de chargement.') + '</div>';
        return;
    }

    const list = Array.isArray(data) ? data : [];

    // Update the badge counter
    const badge = document.getElementById('pending-count-badge');
    if (badge) badge.textContent = list.length;

    if (!list.length) {
        container.innerHTML =
            '<div class="text-center py-5 text-muted">' +
                '<i class="bi bi-check-circle fs-1 text-success d-block mb-2"></i>' +
                'Aucune demande en attente.' +
            '</div>';
        return;
    }

    // Build table
    container.innerHTML =
        '<div class="table-responsive">' +
        '<table class="table admin-table table-hover align-middle mb-0">' +
            '<thead><tr>' +
                '<th>Médecin</th>' +
                '<th>Email</th>' +
                '<th>Spécialité</th>' +
                '<th>Expérience</th>' +
                '<th>Statut</th>' +
                '<th class="text-end">Actions</th>' +
            '</tr></thead>' +
            '<tbody id="pending-tbody">' +
            list.map(function(doc) {
                return (
                    '<tr id="pending-row-' + doc.id + '">' +
                        '<td class="fw-semibold">Dr. ' + (doc.firstName || '') + ' ' + (doc.lastName || '') + '</td>' +
                        '<td class="text-muted small">' + (doc.email || '-') + '</td>' +
                        '<td>' + (doc.specialty || '-') + '</td>' +
                        '<td>' + (doc.experienceYears != null ? doc.experienceYears + ' ans' : '-') + '</td>' +
                        '<td><span class="badge badge-pending">EN ATTENTE</span></td>' +
                        '<td class="text-end">' +
                            '<button class="btn btn-sm btn-success fw-bold me-2" onclick="verifyDoctor(' + doc.id + ')">' +
                                '<i class="bi bi-check-lg me-1"></i>Valider' +
                            '</button>' +
                            '<button class="btn btn-sm btn-outline-danger fw-bold" onclick="rejectDoctor(' + doc.id + ', \'' + (doc.firstName || '') + ' ' + (doc.lastName || '') + '\')">' +
                                '<i class="bi bi-x-lg me-1"></i>Rejeter' +
                            '</button>' +
                        '</td>' +
                    '</tr>'
                );
            }).join('') +
            '</tbody>' +
        '</table>' +
        '</div>';
}

// Approves a doctor — calls PUT /api/admin/doctors/{id}/verify.
async function verifyDoctor(doctorId) {
    try {
        const response = await apiFetch('/admin/doctors/' + doctorId + '/verify', { method: 'PUT' });
        if (!response) return;
        if (!response.ok) throw new Error((await response.json().catch(function() { return {}; })).message || 'Erreur.');

        showAdminNotice('Médecin validé avec succès.');
        // Refresh both the pending list and the stats counter
        await Promise.all([loadPendingDoctors(), loadStats()]);
    } catch (err) {
        showAdminNotice(err.message);
    }
}
window.verifyDoctor = verifyDoctor;

// Rejects a doctor — calls PUT /api/admin/doctors/{id}/reject.
// Shows a confirmation dialog first to prevent accidental clicks.
function rejectDoctor(doctorId, doctorName) {
    showConfirm(
        'Rejeter la demande',
        'Rejeter la demande de Dr. ' + doctorName + ' ? Le médecin recevra le statut REJECTED.',
        async function() {
            try {
                const response = await apiFetch('/admin/doctors/' + doctorId + '/reject', { method: 'PUT' });
                if (!response) return;
                if (!response.ok) throw new Error((await response.json().catch(function() { return {}; })).message || 'Erreur.');

                showAdminNotice('Demande rejetée.');
                await Promise.all([loadPendingDoctors(), loadStats()]);
            } catch (err) {
                showAdminNotice(err.message);
            }
        }
    );
}
window.rejectDoctor = rejectDoctor;

// ══════════════════════════════════════════════════════════════
//  ALL USERS — User management table
// ══════════════════════════════════════════════════════════════

// Fetches the full user list from /api/admin/users.
async function loadAllUsers() {
    const container = document.getElementById('users-table-container');
    if (!container) return;

    container.innerHTML = '<div class="text-muted small">Chargement...</div>';

    const response = await apiFetch('/admin/users', { method: 'GET' });
    if (!response) return;

    const data = await response.json().catch(function() { return []; });
    if (!response.ok) {
        container.innerHTML = '<div class="alert alert-danger">' + (data.message || 'Erreur de chargement.') + '</div>';
        return;
    }

    allUsersCache = Array.isArray(data) ? data : [];
    renderUsersTable(allUsersCache);
}

// Renders the users table from a given array (used by both loadAllUsers and filterUsers).
function renderUsersTable(users) {
    const container = document.getElementById('users-table-container');
    if (!container) return;

    if (!users.length) {
        container.innerHTML = '<div class="text-center py-4 text-muted">Aucun utilisateur trouvé.</div>';
        return;
    }

    container.innerHTML =
        '<div class="table-responsive">' +
        '<table class="table admin-table table-hover align-middle mb-0">' +
            '<thead><tr>' +
                '<th>ID</th>' +
                '<th>Nom complet</th>' +
                '<th>Email</th>' +
                '<th>Téléphone</th>' +
                '<th>Rôle</th>' +
                '<th>Statut vérif.</th>' +
                '<th class="text-end">Actions</th>' +
            '</tr></thead>' +
            '<tbody>' +
            users.map(function(u) {
                // Role badge colour
                var roleBadge = '';
                var roleUpper = (u.role || '').toUpperCase();
                if (roleUpper === 'PATIENT') roleBadge = 'badge-role-patient';
                else if (roleUpper === 'DOCTOR') roleBadge = 'badge-role-doctor';
                else roleBadge = 'badge-role-admin';

                // Verification badge (only shown for doctors)
                var verifBadge = '-';
                if (roleUpper === 'DOCTOR') {
                    var vs = (u.verificationStatus || 'PENDING').toUpperCase();
                    var vc = vs === 'VERIFIED' ? 'badge-verified' : vs === 'REJECTED' ? 'badge-rejected' : 'badge-pending';
                    verifBadge = '<span class="badge ' + vc + '">' + vs + '</span>';
                }

                var safeName = ((u.firstName || '') + ' ' + (u.lastName || '')).trim().replace(/'/g, "\\'");

                return (
                    '<tr>' +
                        '<td class="text-muted small">#' + u.id + '</td>' +
                        '<td class="fw-semibold">' + (u.firstName || '') + ' ' + (u.lastName || '') + '</td>' +
                        '<td class="text-muted small">' + (u.email || '-') + '</td>' +
                        '<td class="text-muted small">' + (u.phone || '-') + '</td>' +
                        '<td><span class="badge ' + roleBadge + '">' + roleUpper + '</span></td>' +
                        '<td>' + verifBadge + '</td>' +
                        '<td class="text-end">' +
                            '<button class="btn btn-sm btn-outline-danger fw-bold" onclick="deleteUser(' + u.id + ', \'' + safeName + '\')">' +
                                '<i class="bi bi-trash3 me-1"></i>Supprimer' +
                            '</button>' +
                        '</td>' +
                    '</tr>'
                );
            }).join('') +
            '</tbody>' +
        '</table>' +
        '</div>';
}

// Client-side search filter — no extra API call needed.
// Filters allUsersCache by name or email and re-renders the table.
function filterUsers() {
    const query = (document.getElementById('user-search-input').value || '').toLowerCase().trim();
    if (!query) {
        renderUsersTable(allUsersCache);
        return;
    }
    const filtered = allUsersCache.filter(function(u) {
        const fullName = ((u.firstName || '') + ' ' + (u.lastName || '')).toLowerCase();
        const email    = (u.email || '').toLowerCase();
        return fullName.includes(query) || email.includes(query);
    });
    renderUsersTable(filtered);
}
window.filterUsers = filterUsers;

// Deletes a user — calls DELETE /api/admin/users/{id}.
// Shows a confirmation dialog first.
function deleteUser(userId, userName) {
    showConfirm(
        'Supprimer le compte',
        'Supprimer le compte de ' + (userName || 'cet utilisateur') + ' ? Cette action est irréversible.',
        async function() {
            try {
                const response = await apiFetch('/admin/users/' + userId, { method: 'DELETE' });
                if (!response) return;
                if (!response.ok) throw new Error((await response.json().catch(function() { return {}; })).message || 'Erreur.');

                showAdminNotice('Compte supprimé.');
                await Promise.all([loadAllUsers(), loadStats()]);
            } catch (err) {
                showAdminNotice(err.message);
            }
        }
    );
}
window.deleteUser = deleteUser;

// ══════════════════════════════════════════════════════════════
//  INIT — DOMContentLoaded
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {

    // ── Guard: only ADMIN can access this page ──
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    if ((user.role || '').toUpperCase() !== 'ADMIN') {
        // Non-admin who somehow lands here gets sent to the regular dashboard
        window.location.href = 'main.html';
        return;
    }

    // Show the logged-in admin's name in the header
    const nameLabel = document.getElementById('admin-name-label');
    if (nameLabel) nameLabel.textContent = (user.firstName || '') + ' ' + (user.lastName || '') + ' (Admin)';

    // Logout button clears localStorage and goes to login
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            clearSession();
        });
    }

    // Load pending doctors when the "En attente" tab is shown
    document.getElementById('tab-pending-btn').addEventListener('shown.bs.tab', function() {
        loadPendingDoctors();
    });

    // Load all users when the "Tous les utilisateurs" tab is shown
    document.getElementById('tab-users-btn').addEventListener('shown.bs.tab', function() {
        loadAllUsers();
    });

    // Initial load: stats + default (pending) tab
    Promise.all([loadStats(), loadPendingDoctors()]).catch(function(err) {
        console.error('Admin init error:', err);
    });
});
