// ─────────────────────────────────────────────────────────────
// admin-page.js — TBIBI Admin Dashboard
//
// API endpoints used:
//   GET    /api/admin/stats                       → stat cards + charts
//   GET    /api/admin/stats/monthly               → monthly registrations chart
//   GET    /api/admin/doctors/pending             → pending verification list
//   GET    /api/admin/doctors/{id}/documents      → doctor uploaded files
//   PUT    /api/admin/doctors/{id}/verify         → approve a doctor
//   PUT    /api/admin/doctors/{id}/reject         → reject a doctor
//   GET    /api/admin/users                       → full user list
//   DELETE /api/admin/users/{id}                  → delete a user account
// ─────────────────────────────────────────────────────────────

const API_BASE_URL     = window.TBIBI_API_BASE || 'http://localhost:8084/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';

// ── State ─────────────────────────────────────────────────────
let allUsersCache       = [];
let chartUsersInst      = null;
let chartVerifInst      = null;
let chartMonthlyInst    = null;
let chartOverviewInst   = null;
let currentDocDoctorId  = null;
let currentDocDoctor    = null;   // full doctor object for the modal

// ── Auth helpers ───────────────────────────────────────────────
function clearSession() { localStorage.clear(); }

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('tbibi_user');
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

// Generic fetch — adds Authorization header, redirects on 401.
async function apiFetch(path, options) {
    options = options || {};
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
    const headers = Object.assign(
        {},
        (options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        (token ? { Authorization: 'Bearer ' + token } : {}),
        (options.headers || {})
    );
    const response = await fetch(API_BASE_URL + path, Object.assign({}, options, { headers: headers }));
    if (response.status === 401) {
        clearSession();
        window.location.href = 'login.html';
        return null;
    }
    return response;
}

// ── Toast ──────────────────────────────────────────────────────
function showAdminNotice(message) {
    var el   = document.getElementById('admin-toast');
    var body = document.getElementById('admin-toast-body');
    if (!el || !body) return;
    body.textContent = message;
    bootstrap.Toast.getOrCreateInstance(el, { delay: 4000 }).show();
}

// ── Confirm modal ──────────────────────────────────────────────
function showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').textContent  = message;

    var okBtn    = document.getElementById('confirm-modal-ok');
    var newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('confirmModal'));
    newOkBtn.addEventListener('click', function() { modal.hide(); onConfirm(); });
    modal.show();
}

// ══════════════════════════════════════════════════════════════
//  STATS — Stat cards
// ══════════════════════════════════════════════════════════════
async function loadStats() {
    var row = document.getElementById('stats-row');
    if (!row) return null;

    var response = await apiFetch('/admin/stats', { method: 'GET' });
    if (!response) return null;

    var data = await response.json().catch(function() { return {}; });
    if (!response.ok) {
        row.innerHTML = '<div class="alert alert-danger">' + (data.message || 'Impossible de charger les statistiques.') + '</div>';
        return null;
    }

    var cards = [
        { value: data.totalUsers    || 0, label: 'Utilisateurs total',        icon: 'bi-people-fill',      color: 'bg-primary-subtle text-primary', trend: null },
        { value: data.totalDoctors  || 0, label: 'Médecins',                  icon: 'bi-heart-pulse-fill', color: 'bg-success-subtle text-success', trend: null },
        { value: data.totalPatients || 0, label: 'Patients',                  icon: 'bi-person-fill',      color: 'bg-info-subtle text-info',       trend: null },
        { value: data.pendingDoctors|| 0, label: 'Vérifications en attente',  icon: 'bi-hourglass-split',  color: 'bg-warning-subtle text-warning', trend: data.pendingDoctors > 0 ? 'warn' : null }
    ];

    row.innerHTML = cards.map(function(c) {
        var trendHtml = c.trend === 'warn'
            ? '<div class="stat-trend warn"><i class="bi bi-exclamation-circle me-1"></i>Action requise</div>'
            : '';
        return (
            '<div class="stat-card">' +
                '<div class="stat-icon ' + c.color + '"><i class="bi ' + c.icon + '"></i></div>' +
                '<div>' +
                    '<div class="stat-value">' + c.value + '</div>' +
                    '<div class="stat-label">' + c.label + '</div>' +
                    trendHtml +
                '</div>' +
            '</div>'
        );
    }).join('');

    var badge = document.getElementById('pending-count-badge');
    if (badge) badge.textContent = data.pendingDoctors || 0;

    return data;
}

// ══════════════════════════════════════════════════════════════
//  CHARTS — Chart.js rendering
// ══════════════════════════════════════════════════════════════

// Palette
var CHART_COLORS = {
    primary:  '#0068c9',
    success:  '#08b158',
    warning:  '#f6a623',
    danger:   '#dc3545',
    teal:     '#0a9396',
    purple:   '#7c3aed',
    blue2:    '#4fa3ff',
    softBg:   'rgba(0,104,201,.08)'
};

function destroyChart(inst) {
    if (inst) { try { inst.destroy(); } catch(e) {} }
    return null;
}

// Renders all four charts using data from /api/admin/stats
function renderCharts(stats) {
    renderUserDistChart(stats);
    renderVerifStatusChart(stats);
    renderMonthlyChart();      // fetches its own endpoint
    renderOverviewChart(stats);
}

// ── Chart 1: User distribution (donut) ────────────────────────
function renderUserDistChart(stats) {
    var canvas = document.getElementById('chart-users-dist');
    if (!canvas) return;

    var patients = stats.totalPatients || 0;
    var doctors  = stats.totalDoctors  || 0;
    var total    = patients + doctors;

    var center = document.getElementById('donut1-val');
    if (center) center.textContent = total;

    chartUsersInst = destroyChart(chartUsersInst);
    chartUsersInst = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Patients', 'Médecins'],
            datasets: [{
                data: [patients, doctors],
                backgroundColor: [CHART_COLORS.primary, CHART_COLORS.success],
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 6
            }]
        },
        options: {
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12, family: "'Plus Jakarta Sans', system-ui" }, padding: 16, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            var pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
                            return ' ' + ctx.label + ' : ' + ctx.parsed + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

// ── Chart 2: Doctor verification status (donut) ────────────────
function renderVerifStatusChart(stats) {
    var canvas = document.getElementById('chart-verif-status');
    if (!canvas) return;

    var pending  = stats.pendingDoctors  || 0;
    var verified = stats.verifiedDoctors || Math.max(0, (stats.totalDoctors || 0) - (stats.pendingDoctors || 0) - (stats.rejectedDoctors || 0));
    var rejected = stats.rejectedDoctors || 0;
    var total    = stats.totalDoctors    || 0;

    var center = document.getElementById('donut2-val');
    if (center) center.textContent = total;

    chartVerifInst = destroyChart(chartVerifInst);
    chartVerifInst = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Validés', 'En attente', 'Rejetés'],
            datasets: [{
                data: [verified, pending, rejected],
                backgroundColor: [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger],
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 6
            }]
        },
        options: {
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12, family: "'Plus Jakarta Sans', system-ui" }, padding: 16, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            var pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
                            return ' ' + ctx.label + ' : ' + ctx.parsed + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

// ── Chart 3: Monthly registrations (bar) ──────────────────────
async function renderMonthlyChart() {
    var canvas = document.getElementById('chart-monthly-reg');
    if (!canvas) return;

    // Try the dedicated endpoint; fall back to placeholder data if it doesn't exist
    var labels = [];
    var values = [];

    var response = await apiFetch('/admin/stats/monthly', { method: 'GET' });
    if (response && response.ok) {
        var monthlyData = await response.json().catch(function() { return []; });
        if (Array.isArray(monthlyData) && monthlyData.length) {
            monthlyData.forEach(function(entry) {
                labels.push(entry.month || entry.label || '');
                values.push(entry.count || entry.value || 0);
            });
        }
    }

    // Fallback: generate last 12 month labels with zeros
    if (!labels.length) {
        var now = new Date();
        var monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
        for (var i = 11; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(monthNames[d.getMonth()] + ' ' + d.getFullYear());
            values.push(0);
        }
    }

    chartMonthlyInst = destroyChart(chartMonthlyInst);
    chartMonthlyInst = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inscriptions',
                data: values,
                backgroundColor: 'rgba(10,147,150,.18)',
                borderColor: CHART_COLORS.teal,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return ' ' + ctx.parsed.y + ' inscription(s)'; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11, family: "'Plus Jakarta Sans', system-ui" }, color: '#6b7280' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 11 }, color: '#6b7280', precision: 0 }
                }
            }
        }
    });
}

// ── Chart 4: Platform overview (horizontal bar) ────────────────
function renderOverviewChart(stats) {
    var canvas = document.getElementById('chart-overview');
    if (!canvas) return;

    var labels = ['Utilisateurs total', 'Médecins validés', 'Patients', 'En attente vérif.'];
    var verified = stats.verifiedDoctors ||
        Math.max(0, (stats.totalDoctors || 0) - (stats.pendingDoctors || 0) - (stats.rejectedDoctors || 0));

    var values = [
        stats.totalUsers    || 0,
        verified,
        stats.totalPatients || 0,
        stats.pendingDoctors|| 0
    ];
    var colors = [CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.teal, CHART_COLORS.warning];

    chartOverviewInst = destroyChart(chartOverviewInst);
    chartOverviewInst = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valeur',
                data: values,
                backgroundColor: colors.map(function(c) { return c + '33'; }),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return ' ' + ctx.parsed.x; }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 11 }, color: '#6b7280', precision: 0 }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 12, family: "'Plus Jakarta Sans', system-ui", weight: '600' }, color: '#2d3f55' }
                }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════
//  PENDING DOCTORS — Verification queue
// ══════════════════════════════════════════════════════════════
async function loadPendingDoctors() {
    var container = document.getElementById('pending-table-container');
    if (!container) return;

    container.innerHTML = '<div class="text-muted small">Chargement...</div>';

    var response = await apiFetch('/admin/doctors/pending', { method: 'GET' });
    if (!response) return;

    var data = await response.json().catch(function() { return []; });
    if (!response.ok) {
        container.innerHTML = '<div class="alert alert-danger">' + (data.message || 'Erreur de chargement.') + '</div>';
        return;
    }

    var list = Array.isArray(data) ? data : [];

    var badge = document.getElementById('pending-count-badge');
    if (badge) badge.textContent = list.length;

    if (!list.length) {
        container.innerHTML =
            '<div class="text-center py-5 text-muted">' +
                '<i class="bi bi-check-circle fs-1 text-success d-block mb-2"></i>' +
                'Aucune demande en attente.' +
            '</div>';
        return;
    }

    container.innerHTML =
        '<div class="table-responsive">' +
        '<table class="table admin-table table-hover align-middle mb-0">' +
            '<thead><tr>' +
                '<th>Médecin</th>' +
                '<th>Email</th>' +
                '<th>Spécialité</th>' +
                '<th>Expérience</th>' +
                '<th>Dossier</th>' +
                '<th>Statut</th>' +
                '<th class="text-end">Actions</th>' +
            '</tr></thead>' +
            '<tbody id="pending-tbody">' +
            list.map(function(doc) {
                var docJson = encodeURIComponent(JSON.stringify({
                    id: doc.id,
                    firstName: doc.firstName || '',
                    lastName:  doc.lastName  || '',
                    email:     doc.email     || '',
                    specialty: doc.specialty || '',
                    experienceYears: doc.experienceYears
                }));
                return (
                    '<tr id="pending-row-' + doc.id + '">' +
                        '<td class="fw-semibold">Dr. ' + (doc.firstName || '') + ' ' + (doc.lastName || '') + '</td>' +
                        '<td class="text-muted small">' + (doc.email || '-') + '</td>' +
                        '<td>' + (doc.specialty || '-') + '</td>' +
                        '<td>' + (doc.experienceYears != null ? doc.experienceYears + ' ans' : '-') + '</td>' +
                        '<td>' +
                            '<button class="btn btn-sm btn-outline-primary fw-semibold" ' +
                                    'onclick="viewDoctorDocuments(\'' + docJson + '\')" ' +
                                    'title="Voir les documents soumis">' +
                                '<i class="bi bi-folder2-open me-1"></i>Voir dossier' +
                            '</button>' +
                        '</td>' +
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

// ══════════════════════════════════════════════════════════════
//  DOCUMENT VIEWER MODAL
// ══════════════════════════════════════════════════════════════

// Opens the document modal and fetches the doctor's uploaded files.
// doctorJson is a URL-encoded JSON string with the doctor's basic info.
async function viewDoctorDocuments(doctorJson) {
    var doc;
    try { doc = JSON.parse(decodeURIComponent(doctorJson)); } catch(e) { return; }

    currentDocDoctorId = doc.id;
    currentDocDoctor   = doc;

    // Fill doctor banner
    var initials = ((doc.firstName || '?')[0] + (doc.lastName || '?')[0]).toUpperCase();
    document.getElementById('doc-doctor-initials').textContent  = initials;
    document.getElementById('doc-doctor-fullname').textContent  = 'Dr. ' + (doc.firstName || '') + ' ' + (doc.lastName || '');
    document.getElementById('doc-doctor-details').textContent   =
        (doc.specialty || 'Spécialité inconnue') +
        (doc.experienceYears != null ? ' · ' + doc.experienceYears + ' ans d\'expérience' : '') +
        (doc.email ? ' · ' + doc.email : '');

    // Wire the action buttons
    var verifyBtn = document.getElementById('doc-modal-verify-btn');
    var rejectBtn = document.getElementById('doc-modal-reject-btn');
    var newVerify = verifyBtn.cloneNode(true);
    var newReject = rejectBtn.cloneNode(true);
    verifyBtn.parentNode.replaceChild(newVerify, verifyBtn);
    rejectBtn.parentNode.replaceChild(newReject, rejectBtn);

    newVerify.addEventListener('click', function() {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('docModal')).hide();
        verifyDoctor(currentDocDoctorId);
    });
    newReject.addEventListener('click', function() {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('docModal')).hide();
        rejectDoctor(currentDocDoctorId, (currentDocDoctor.firstName || '') + ' ' + (currentDocDoctor.lastName || ''));
    });

    // Show modal with loading state
    var bodyEl = document.getElementById('doc-modal-body');
    bodyEl.innerHTML =
        '<div class="text-center py-5">' +
            '<div class="spinner-border text-primary" role="status"></div>' +
            '<p class="text-muted small mt-2 mb-0">Chargement des documents...</p>' +
        '</div>';

    bootstrap.Modal.getOrCreateInstance(document.getElementById('docModal')).show();

    // Fetch the doctor's uploaded documents
    var response = await apiFetch('/admin/doctors/' + doc.id + '/documents', { method: 'GET' });

    if (!response || !response.ok) {
        bodyEl.innerHTML = renderDocFallback(doc);
        return;
    }

    var docs = await response.json().catch(function() { return []; });

    if (!Array.isArray(docs) || !docs.length) {
        bodyEl.innerHTML = renderDocFallback(doc);
        return;
    }

    bodyEl.innerHTML = '<div class="doc-list">' + docs.map(renderDocItem).join('') + '</div>';
}

// Converts a relative API path (/api/...) to a full server URL.
// The backend returns relative paths; we prepend the server origin.
function toAbsoluteUrl(url) {
    if (!url || url === '#') return '#';
    if (url.startsWith('http')) return url;
    // API_BASE_URL = 'http://localhost:8084/api'
    // Strip '/api' suffix to get the server root, then append the path.
    var serverRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    return serverRoot + url;
}

// Doc type labels shown in the modal
var DOC_TYPE_LABELS = {
    'ID_CARD':   'Carte d\'identité',
    'DIPLOMA':   'Diplôme',
    'LICENSE':   'Autorisation d\'exercice',
    'CERTIFICATE': 'Certificat',
    'OTHER':     'Autre document'
};

// Renders a single document item row
function renderDocItem(d) {
    var name     = d.fileName || d.name || 'Document';
    var rawUrl   = d.fileUrl  || d.url  || '#';
    var url      = toAbsoluteUrl(rawUrl);
    var isPdf    = /\.pdf$/i.test(name);
    var isImage  = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
    var typeKey  = (d.docType || d.type || '').toUpperCase();
    var typeText = DOC_TYPE_LABELS[typeKey] || typeKey || 'Document';
    var typeLabel = typeText
        ? '<span class="badge bg-light text-secondary border me-2" style="font-size:.68rem">' + typeText + '</span>'
        : '';

    var iconClass = isPdf ? 'pdf' : isImage ? 'img' : 'file';
    var iconName  = isPdf ? 'bi-file-earmark-pdf' : isImage ? 'bi-image' : 'bi-file-earmark';

    var previewHtml = '';
    if (isImage && url !== '#') {
        previewHtml = '<img src="' + url + '" class="doc-preview-img" alt="' + name + '">';
    }

    return (
        '<div class="doc-item">' +
            '<div class="doc-item-icon ' + iconClass + '">' +
                '<i class="bi ' + iconName + '"></i>' +
            '</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div class="doc-item-name">' + typeLabel + name + '</div>' +
                previewHtml +
            '</div>' +
            (url !== '#'
                ? '<a href="' + url + '" target="_blank" class="btn btn-sm btn-outline-primary flex-shrink-0">' +
                      '<i class="bi bi-eye me-1"></i>Ouvrir' +
                  '</a>'
                : '') +
        '</div>'
    );
}

// Fallback when no documents endpoint or empty list
function renderDocFallback(doc) {
    return (
        '<div class="doc-empty-state">' +
            '<i class="bi bi-folder2-open"></i>' +
            '<p class="fw-semibold mb-1">Aucun document disponible</p>' +
            '<p class="small text-muted mb-0">' +
                'Le médecin n\'a pas encore soumis de fichiers, ou l\'endpoint' +
                ' <code>/api/admin/doctors/' + doc.id + '/documents</code> n\'est pas encore implémenté.' +
            '</p>' +
        '</div>'
    );
}

window.viewDoctorDocuments = viewDoctorDocuments;

// ── Verify / Reject ────────────────────────────────────────────
async function verifyDoctor(doctorId) {
    try {
        var response = await apiFetch('/admin/doctors/' + doctorId + '/verify', { method: 'PUT' });
        if (!response) return;
        if (!response.ok) throw new Error(((await response.json().catch(function(){ return {}; })).message) || 'Erreur.');
        showAdminNotice('✅ Médecin validé avec succès.');
        await Promise.all([loadPendingDoctors(), loadStats()]);
    } catch (err) { showAdminNotice(err.message); }
}
window.verifyDoctor = verifyDoctor;

function rejectDoctor(doctorId, doctorName) {
    showConfirm(
        'Rejeter la demande',
        'Rejeter la demande de Dr. ' + doctorName + ' ? Le médecin recevra le statut REJECTED.',
        async function() {
            try {
                var response = await apiFetch('/admin/doctors/' + doctorId + '/reject', { method: 'PUT' });
                if (!response) return;
                if (!response.ok) throw new Error(((await response.json().catch(function(){ return {}; })).message) || 'Erreur.');
                showAdminNotice('Demande rejetée.');
                await Promise.all([loadPendingDoctors(), loadStats()]);
            } catch (err) { showAdminNotice(err.message); }
        }
    );
}
window.rejectDoctor = rejectDoctor;

// ══════════════════════════════════════════════════════════════
//  ALL USERS — User management table
// ══════════════════════════════════════════════════════════════
async function loadAllUsers() {
    var container = document.getElementById('users-table-container');
    if (!container) return;

    container.innerHTML = '<div class="text-muted small">Chargement...</div>';

    var response = await apiFetch('/admin/users', { method: 'GET' });
    if (!response) return;

    var data = await response.json().catch(function() { return []; });
    if (!response.ok) {
        container.innerHTML = '<div class="alert alert-danger">' + (data.message || 'Erreur de chargement.') + '</div>';
        return;
    }

    allUsersCache = Array.isArray(data) ? data : [];
    renderUsersTable(allUsersCache);
}

function renderUsersTable(users) {
    var container = document.getElementById('users-table-container');
    if (!container) return;

    if (!users.length) {
        container.innerHTML = '<div class="text-center py-4 text-muted">Aucun utilisateur trouvé.</div>';
        return;
    }

    container.innerHTML =
        '<div class="table-responsive">' +
        '<table class="table admin-table table-hover align-middle mb-0">' +
            '<thead><tr>' +
                '<th>ID</th><th>Nom complet</th><th>Email</th><th>Téléphone</th>' +
                '<th>Rôle</th><th>Statut vérif.</th><th class="text-end">Actions</th>' +
            '</tr></thead>' +
            '<tbody>' +
            users.map(function(u) {
                var roleUpper = (u.role || '').toUpperCase();
                var roleCls   = roleUpper === 'PATIENT' ? 'badge-role-patient'
                              : roleUpper === 'DOCTOR'  ? 'badge-role-doctor'
                              : 'badge-role-admin';

                var verifBadge = '-';
                if (roleUpper === 'DOCTOR') {
                    var vs  = (u.verificationStatus || 'PENDING').toUpperCase();
                    var vc  = vs === 'VERIFIED' ? 'badge-verified' : vs === 'REJECTED' ? 'badge-rejected' : 'badge-pending';
                    verifBadge = '<span class="badge ' + vc + '">' + vs + '</span>';
                }

                var safeName = ((u.firstName || '') + ' ' + (u.lastName || '')).trim().replace(/'/g, "\\'");

                return (
                    '<tr>' +
                        '<td class="text-muted small">#' + u.id + '</td>' +
                        '<td class="fw-semibold">' + (u.firstName || '') + ' ' + (u.lastName || '') + '</td>' +
                        '<td class="text-muted small">' + (u.email || '-') + '</td>' +
                        '<td class="text-muted small">' + (u.phone || '-') + '</td>' +
                        '<td><span class="badge ' + roleCls + '">' + roleUpper + '</span></td>' +
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

function filterUsers() {
    var query = (document.getElementById('user-search-input').value || '').toLowerCase().trim();
    if (!query) { renderUsersTable(allUsersCache); return; }
    renderUsersTable(allUsersCache.filter(function(u) {
        var name = ((u.firstName || '') + ' ' + (u.lastName || '')).toLowerCase();
        return name.includes(query) || (u.email || '').toLowerCase().includes(query);
    }));
}
window.filterUsers = filterUsers;

function deleteUser(userId, userName) {
    showConfirm(
        'Supprimer le compte',
        'Supprimer le compte de ' + (userName || 'cet utilisateur') + ' ? Cette action est irréversible.',
        async function() {
            try {
                var response = await apiFetch('/admin/users/' + userId, { method: 'DELETE' });
                if (!response) return;
                if (!response.ok) throw new Error(((await response.json().catch(function(){ return {}; })).message) || 'Erreur.');
                showAdminNotice('Compte supprimé.');
                await Promise.all([loadAllUsers(), loadStats()]);
            } catch (err) { showAdminNotice(err.message); }
        }
    );
}
window.deleteUser = deleteUser;

// ══════════════════════════════════════════════════════════════
//  INIT — DOMContentLoaded
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {

    // Guard: only ADMIN can access this page
    var user = getCurrentUser();
    if (!user) { window.location.href = 'login.html'; return; }
    if ((user.role || '').toUpperCase() !== 'ADMIN') { window.location.href = 'main.html'; return; }

    var nameLabel = document.getElementById('admin-name-label');
    if (nameLabel) nameLabel.textContent = (user.firstName || '') + ' ' + (user.lastName || '') + ' (Admin)';

    var logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', function() { clearSession(); });

    // Bootstrap tab shown events
    document.getElementById('tab-pending-btn').addEventListener('shown.bs.tab', loadPendingDoctors);
    document.getElementById('tab-users-btn').addEventListener('shown.bs.tab', loadAllUsers);
    document.getElementById('tab-stats-btn').addEventListener('shown.bs.tab', function() {
        // Re-render charts when the tab becomes visible (canvas needs visible dimensions)
        loadStats().then(function(data) {
            if (data) renderCharts(data);
        });
    });

    // Initial load
    loadStats().then(function(data) {
        if (data) {
            // Pre-render charts in background so they're ready when the tab opens
            setTimeout(function() { renderCharts(data); }, 100);
        }
    });
    loadPendingDoctors();
});
