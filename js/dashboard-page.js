// ─────────────────────────────────────────────────────────────
// dashboard-page.js — TBIBI main dashboard
// Handles both PATIENT and DOCTOR roles in the same page.
//
// PATIENT sees:
//   Left   → list of available doctors to contact
//   Middle → personal medical files + nearby medical map
//   Right  → selected doctor profile + chat + book appointment
//
// DOCTOR sees:
//   Left   → list of patients who booked appointments
//   Middle → appointment cards with confirm / cancel actions
//   Right  → chat with selected patient
// ─────────────────────────────────────────────────────────────

const API_BASE_URL      = window.TBIBI_API_BASE || 'http://localhost:8084/api';
const ACCESS_TOKEN_KEY  = 'tbibi_access_token';
const searchRadiusMeters = 3000;
const TUNIS_FALLBACK_LAT = 36.8065;
const TUNIS_FALLBACK_LNG = 10.1815;

let doctorsCache   = [];
let allAppointments = [];
let currentPartnerId  = null;
let currentConversationMessages = [];
let lastMedicalBlobUrl = null;
let currentUserId  = null;
let stompClient    = null;
let nearbyMap      = null;
let nearbyMapMarkers = [];

function getAccessToken() { return localStorage.getItem(ACCESS_TOKEN_KEY) || ''; }
function clearSession()   { localStorage.clear(); }

function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('tbibi_user')); }
    catch { return null; }
}

async function apiFetch(path, options = {}) {
    const token = getAccessToken();
    const headers = {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(options.headers || {})
    };
    const response = await fetch(API_BASE_URL + path, Object.assign({}, options, { headers }));
    if (response.status === 401) { clearSession(); window.location.href = 'login.html'; return null; }
    return response;
}

function showDashboardNotice(message) {
    const el = document.getElementById('dashboard-toast');
    const body = document.getElementById('dashboard-toast-body');
    if (!el || !body) return;
    body.textContent = message;
    bootstrap.Toast.getOrCreateInstance(el, { delay: 4500 }).show();
}

function resolveAvatarUrl(d) { return (d && d.avatarUrl) ? d.avatarUrl : '../assets/logo.jpg'; }
function formatExperienceYears(y) { return (y == null || y === '') ? "Experience non renseignee" : y + " ans d'experience"; }
function doctorDisplayName(d) { return ('Dr. ' + (d.firstName || '') + ' ' + (d.lastName || '')).trim(); }

function normalizeDoctor(dto) {
    return {
        id: dto.id,
        firstName: dto.firstName || dto.givenName || '',
        lastName:  dto.lastName  || dto.familyName || '',
        specialty: dto.specialty || dto.speciality || '-',
        experienceYears: dto.experienceYears != null ? dto.experienceYears : null,
        bio: dto.bio || dto.description || '',
        isOnline: Boolean(dto.isOnline),
        avatarUrl: dto.avatarUrl || dto.avatar || '../assets/logo.jpg'
    };
}

// ── Patient mode: doctor list ─────────────────────────────────

function updateDoctorView(doctor) {
    if (!doctor) return;
    var name = doctorDisplayName(doctor);
    var t = document.getElementById('doctor-title');
    var av = document.getElementById('doctor-avatar-summary');
    var sp = document.getElementById('doctor-specialty');
    var st = document.getElementById('doctor-status');
    var ex = document.getElementById('doctor-experience');
    var de = document.getElementById('doctor-description');
    var cn = document.getElementById('chat-doctor-name');
    if (t)  t.textContent  = name;
    if (sp) sp.textContent = doctor.specialty || '-';
    if (ex) ex.textContent = formatExperienceYears(doctor.experienceYears);
    if (de) de.textContent = doctor.bio || 'Aucune description disponible.';
    if (cn) cn.textContent = name;
    if (av) { av.src = resolveAvatarUrl(doctor); av.alt = name; }
    if (st) { var online = doctor.isOnline === true; st.textContent = online ? 'En ligne' : 'Hors ligne'; st.className = 'badge ' + (online ? 'bg-success' : 'bg-secondary'); }
}

async function loadDoctorDetails(doctorId) {
    var cached = doctorsCache.find(function(x) { return String(x.id) === String(doctorId); });
    var response = await apiFetch('/doctors/' + doctorId, { method: 'GET' });
    if (!response) { if (cached) updateDoctorView(cached); return; }
    var payload = await response.json().catch(function() { return {}; });
    if (!response.ok) throw new Error(payload.message || 'Impossible de charger les details du medecin.');
    var doctor = normalizeDoctor(payload);
    doctorsCache = doctorsCache.map(function(d) { return String(d.id) === String(doctor.id) ? Object.assign({}, d, doctor) : d; });
    updateDoctorView(doctor);
}

function renderDoctorList() {
    var container = document.getElementById('doctor-list-container');
    if (!container) return;
    var ph = document.getElementById('doctor-list-placeholder');
    if (ph) ph.remove();
    var anchor = container.querySelector('[data-action="reports"]');
    container.querySelectorAll('.doctor-nav-card[data-doctor-id]').forEach(function(el) { el.remove(); });

    doctorsCache.forEach(function(doctor) {
        var card = document.createElement('div');
        card.className = 'doctor-nav-card';
        card.setAttribute('data-doctor-id', String(doctor.id));
        card.innerHTML = '<img src="' + resolveAvatarUrl(doctor) + '" alt="' + doctorDisplayName(doctor) + '" class="doctor-avatar">' +
            '<div class="ms-3 overflow-hidden">' +
            '<span class="d-block fw-bold text-truncate">' + doctorDisplayName(doctor) + '</span>' +
            '<small class="' + (doctor.isOnline ? 'text-success' : 'text-secondary') + ' text-truncate">' + (doctor.specialty || '-') + '</small></div>';

        card.addEventListener('click', function() {
            container.querySelectorAll('.doctor-nav-card[data-doctor-id]').forEach(function(c) { c.classList.remove('active-doctor'); });
            card.classList.add('active-doctor');
            currentPartnerId = doctor.id;
            document.getElementById('chat-view') && document.getElementById('chat-view').classList.add('d-none');
            document.getElementById('doctor-summary-view') && document.getElementById('doctor-summary-view').classList.remove('d-none');
            loadDoctorDetails(currentPartnerId).catch(function(err) { showDashboardNotice(err.message); updateDoctorView(doctor); });
        });
        anchor ? container.insertBefore(card, anchor) : container.appendChild(card);
    });

    var first = container.querySelector('.doctor-nav-card[data-doctor-id]');
    if (first) {
        first.classList.add('active-doctor');
        currentPartnerId = first.getAttribute('data-doctor-id');
        loadDoctorDetails(currentPartnerId).catch(function(err) {
            showDashboardNotice(err.message);
            var fb = doctorsCache.find(function(x) { return String(x.id) === String(currentPartnerId); });
            if (fb) updateDoctorView(fb);
        });
    }
}

async function loadDoctors() {
    var response = await apiFetch('/doctors', { method: 'GET' });
    if (!response) return;
    var payload = await response.json().catch(function() { return []; });
    if (!response.ok) throw new Error(payload.message || 'Impossible de charger les medecins.');
    doctorsCache = (Array.isArray(payload) ? payload : payload.items || []).map(normalizeDoctor);
    renderDoctorList();
}

// ── Patient mode: medical files ───────────────────────────────

async function loadMedicalFiles() {
    var listEl  = document.getElementById('file-history-list');
    var emptyEl = document.getElementById('file-history-empty');
    if (!listEl) return;
    var response = await apiFetch('/patients/' + currentUserId + '/medical-files', { method: 'GET' });
    if (!response) return;
    var payload = await response.json().catch(function() { return []; });
    if (!response.ok) throw new Error(payload.message || 'Impossible de charger les fichiers.');
    var files = (Array.isArray(payload) ? payload : payload.items || []).map(function(dto) {
        return { id: dto.id, name: dto.originalFileName || dto.fileName || dto.name || 'Document ' + dto.id, createdAt: dto.createdAt || null };
    });
    listEl.querySelectorAll('[data-file-id]').forEach(function(el) { el.remove(); });
    if (!files.length) { if (emptyEl) { emptyEl.textContent = 'Aucun fichier pour le moment.'; emptyEl.classList.remove('d-none'); } return; }
    if (emptyEl) emptyEl.classList.add('d-none');
    files.forEach(function(file) {
        var item = document.createElement('div');
        item.className = 'd-flex justify-content-between align-items-center list-group-item list-group-item-action';
        item.setAttribute('data-file-id', String(file.id));
        item.innerHTML = '<div><span class="d-block">' + file.name + '</span><small class="text-muted">' + (file.createdAt || '') + '</small></div>' +
            '<div class="d-flex gap-2"><button class="btn btn-sm btn-outline-primary" data-action="view">Voir</button>' +
            '<button class="btn btn-sm btn-outline-danger" data-action="delete">Supprimer</button></div>';
        item.querySelector('[data-action="view"]').addEventListener('click', function() { loadFileById(file.id, file.name); });
        item.querySelector('[data-action="delete"]').addEventListener('click', async function() {
            if (!window.confirm('Supprimer ' + file.name + ' ?')) return;
            var res = await apiFetch('/patients/' + currentUserId + '/medical-files/' + file.id, { method: 'DELETE' });
            if (res && res.ok) { showDashboardNotice('Fichier supprime.'); await loadMedicalFiles(); }
        });
        listEl.appendChild(item);
    });
}

async function loadFileById(fileId, fileName) {
    var iframe = document.getElementById('medical-file-iframe');
    var title  = document.getElementById('current-file-title');
    if (!iframe) return;
    var response = await apiFetch('/patients/' + currentUserId + '/medical-files/' + fileId + '/download', { method: 'GET' });
    if (!response || !response.ok) { showDashboardNotice('Impossible de charger le document.'); return; }
    var blob = await response.blob();
    if (lastMedicalBlobUrl) URL.revokeObjectURL(lastMedicalBlobUrl);
    lastMedicalBlobUrl = URL.createObjectURL(blob);
    iframe.src = lastMedicalBlobUrl;
    if (title) title.textContent = fileName || 'Document ' + fileId;
}

// ── Patient mode: book appointment form ──────────────────────

function attachBookingForm() {
    var summaryView = document.getElementById('doctor-summary-view');
    if (!summaryView || document.getElementById('booking-form-section')) return;
    var section = document.createElement('div');
    section.id = 'booking-form-section';
    section.className = 'mt-4 border-top pt-3';
    section.innerHTML = '<h6 class="fw-bold mb-3"><i class="bi bi-calendar-plus me-1 text-primary"></i> Prendre un rendez-vous</h6>' +
        '<div class="mb-2"><label class="form-label small fw-semibold">Date et heure</label>' +
        '<input type="datetime-local" class="form-control form-control-sm" id="booking-datetime"></div>' +
        '<div class="mb-2"><label class="form-label small fw-semibold">Motif</label>' +
        '<input type="text" class="form-control form-control-sm" id="booking-reason" placeholder="Ex : Controle annuel..."></div>' +
        '<button class="btn btn-primary btn-sm w-100 fw-bold" id="booking-submit-btn"><i class="bi bi-send me-1"></i> Confirmer</button>' +
        '<div id="booking-feedback" class="mt-2 small"></div>';
    summaryView.appendChild(section);

    document.getElementById('booking-submit-btn').addEventListener('click', async function() {
        var dt = document.getElementById('booking-datetime').value;
        var reason = document.getElementById('booking-reason').value.trim();
        var fb = document.getElementById('booking-feedback');
        if (!dt) { fb.innerHTML = '<span class="text-danger">Choisissez une date.</span>'; return; }
        if (!currentPartnerId) { fb.innerHTML = '<span class="text-danger">Selectionnez un medecin.</span>'; return; }
        try {
            var res = await apiFetch('/appointments', { method: 'POST', body: JSON.stringify({ patientId: currentUserId, doctorId: Number(currentPartnerId), scheduledAt: dt, reason: reason || 'Consultation' }) });
            if (!res) return;
            var data = await res.json().catch(function() { return {}; });
            if (!res.ok) throw new Error(data.message || 'Impossible de reserver.');
            fb.innerHTML = '<span class="text-success"><i class="bi bi-check-circle me-1"></i>Rendez-vous cree !</span>';
            document.getElementById('booking-datetime').value = '';
            document.getElementById('booking-reason').value = '';
        } catch (err) { fb.innerHTML = '<span class="text-danger">' + err.message + '</span>'; }
    });
}

// ── Doctor mode ───────────────────────────────────────────────

function statusColor(s) { return { ALL:'primary', PENDING:'warning', CONFIRMED:'success', COMPLETED:'secondary', CANCELLED:'danger' }[s] || 'secondary'; }

function initDoctorMode(user) {
    var leftTitle = document.querySelector('.doctor-messenger-nav h6');
    if (leftTitle) leftTitle.innerHTML = '<i class="bi bi-people-fill me-1"></i> Mes Patients';

    var fileArea = document.querySelector('.file-viewer-area');
    if (fileArea) {
        fileArea.innerHTML = '<h3 class="fw-bold text-primary mb-3"><i class="bi bi-calendar-check me-2"></i> Mes Rendez-vous</h3>' +
            '<div class="mb-3 d-flex gap-2 flex-wrap" id="appt-filter-tabs">' +
            '<button class="btn btn-sm btn-primary appt-filter-btn active" data-filter="ALL">Tous</button>' +
            '<button class="btn btn-sm btn-outline-warning appt-filter-btn" data-filter="PENDING">En attente</button>' +
            '<button class="btn btn-sm btn-outline-success appt-filter-btn" data-filter="CONFIRMED">Confirmes</button>' +
            '<button class="btn btn-sm btn-outline-secondary appt-filter-btn" data-filter="COMPLETED">Termines</button>' +
            '<button class="btn btn-sm btn-outline-danger appt-filter-btn" data-filter="CANCELLED">Annules</button></div>' +
            '<div id="appointments-container"><div class="text-muted small p-3">Chargement...</div></div>';

        fileArea.querySelectorAll('.appt-filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                fileArea.querySelectorAll('.appt-filter-btn').forEach(function(b) {
                    b.classList.remove('active','btn-primary','btn-warning','btn-success','btn-secondary','btn-danger');
                    b.classList.add('btn-outline-' + statusColor(b.dataset.filter));
                });
                btn.classList.remove('btn-outline-' + statusColor(btn.dataset.filter));
                btn.classList.add('active', 'btn-' + statusColor(btn.dataset.filter));
                renderAppointments(btn.dataset.filter);
            });
        });
    }

    var dt = document.getElementById('doctor-title');
    if (dt) dt.textContent = 'Dr. ' + user.firstName + ' ' + user.lastName;
    var dd = document.getElementById('doctor-description');
    if (dd) dd.textContent = 'Cliquez sur Chat dans un rendez-vous pour contacter le patient.';

    loadDoctorAppointments();
}

async function loadDoctorAppointments() {
    var container = document.getElementById('appointments-container');
    if (!container) return;
    var response = await apiFetch('/appointments/doctor/' + currentUserId, { method: 'GET' });
    if (!response) return;
    var payload = await response.json().catch(function() { return []; });
    if (!response.ok) { container.innerHTML = '<div class="alert alert-danger">' + (payload.message || 'Erreur.') + '</div>'; return; }
    allAppointments = Array.isArray(payload) ? payload : [];
    buildPatientList(allAppointments);
    renderAppointments('ALL');
}

function renderAppointments(filter) {
    var container = document.getElementById('appointments-container');
    if (!container) return;
    var list = filter === 'ALL' ? allAppointments : allAppointments.filter(function(a) { return a.status === filter; });
    if (!list.length) { container.innerHTML = '<div class="text-muted p-3 text-center">Aucun rendez-vous' + (filter !== 'ALL' ? ' dans cette categorie' : '') + '.</div>'; return; }
    container.innerHTML = list.map(function(appt) {
        var dt = appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleString('fr-FR') : '-';
        var color = statusColor(appt.status);
        var safeName = (appt.patientName || 'Patient').replace(/'/g, "\\'");
        var confirmBtns = appt.status === 'PENDING' ?
            '<div class="mt-3 d-flex gap-2">' +
            '<button class="btn btn-sm btn-success fw-bold" onclick="updateApptStatus(' + appt.id + ',\'CONFIRMED\')"><i class="bi bi-check-lg me-1"></i>Confirmer</button>' +
            '<button class="btn btn-sm btn-outline-danger fw-bold" onclick="updateApptStatus(' + appt.id + ',\'CANCELLED\')"><i class="bi bi-x-lg me-1"></i>Annuler</button></div>' : '';
        return '<div class="card mb-3 shadow-sm border-0"><div class="card-body">' +
            '<div class="d-flex justify-content-between align-items-start">' +
            '<div><h6 class="fw-bold mb-1"><i class="bi bi-person-fill me-1 text-primary"></i>' + (appt.patientName || 'Patient') + '</h6>' +
            '<div class="text-muted small mb-1"><i class="bi bi-clock me-1"></i>' + dt + '</div>' +
            '<div class="text-muted small"><i class="bi bi-chat-square-text me-1"></i>' + (appt.reason || '-') + '</div></div>' +
            '<span class="badge bg-' + color + '-subtle text-' + color + '">' + appt.status + '</span></div>' +
            confirmBtns +
            '<div class="mt-2"><button class="btn btn-sm btn-outline-primary fw-bold" onclick="openChatWithPatient(' + appt.patientId + ',\'' + safeName + '\')"><i class="bi bi-chat-left-text me-1"></i>Chat</button></div>' +
            '</div></div>';
    }).join('');
}

async function updateApptStatus(apptId, newStatus) {
    try {
        var res = await apiFetch('/appointments/' + apptId + '/status', { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
        if (!res) return;
        if (!res.ok) throw new Error((await res.json().catch(function(){return{};})).message || 'Erreur.');
        showDashboardNotice(newStatus === 'CONFIRMED' ? 'Rendez-vous confirme.' : 'Rendez-vous annule.');
        await loadDoctorAppointments();
    } catch (err) { showDashboardNotice(err.message); }
}
window.updateApptStatus = updateApptStatus;

function buildPatientList(appointments) {
    var container = document.getElementById('doctor-list-container');
    if (!container) return;
    var ph = document.getElementById('doctor-list-placeholder');
    if (ph) ph.remove();
    container.querySelectorAll('.doctor-nav-card[data-patient-id]').forEach(function(el) { el.remove(); });
    var seen = {}, patients = [];
    appointments.forEach(function(a) { if (!seen[a.patientId]) { seen[a.patientId] = true; patients.push({ id: a.patientId, name: a.patientName || 'Patient ' + a.patientId }); } });
    patients.forEach(function(patient) {
        var card = document.createElement('div');
        card.className = 'doctor-nav-card';
        card.setAttribute('data-patient-id', String(patient.id));
        card.innerHTML = '<img src="../assets/logo.jpg" alt="' + patient.name + '" class="doctor-avatar"><div class="ms-3 overflow-hidden"><span class="d-block fw-bold text-truncate">' + patient.name + '</span><small class="text-secondary">Patient</small></div>';
        card.addEventListener('click', function() {
            container.querySelectorAll('.doctor-nav-card[data-patient-id]').forEach(function(c) { c.classList.remove('active-doctor'); });
            card.classList.add('active-doctor');
            openChatWithPatient(patient.id, patient.name);
        });
        container.appendChild(card);
    });
}

function openChatWithPatient(patientId, patientName) {
    currentPartnerId = patientId;
    var sv = document.getElementById('doctor-summary-view');
    var cv = document.getElementById('chat-view');
    if (sv) sv.classList.add('d-none');
    if (cv) cv.classList.remove('d-none');
    var ne = document.getElementById('chat-doctor-name');
    if (ne) ne.textContent = patientName || 'Patient ' + patientId;
    loadConversation(patientId);
}
window.openChatWithPatient = openChatWithPatient;

// ── Chat ──────────────────────────────────────────────────────

function renderChatMessages(messages) {
    var container = document.querySelector('.chat-messages-container');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach(function(msg) {
        var div = document.createElement('div');
        div.className = 'message ' + (msg.mine ? 'patient-message' : 'doctor-message');
        div.textContent = msg.content || '';
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

function connectWebSocket(userId) {
    if (stompClient && stompClient.connected) return;
    var socket = new SockJS('http://localhost:8084/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;
    stompClient.connect({}, function() {
        stompClient.subscribe('/topic/chat.' + userId, function(frame) {
            var msg = JSON.parse(frame.body);
            currentConversationMessages.push(msg);
            renderChatMessages(currentConversationMessages);
        });
    }, function(err) { console.error('WebSocket error:', err); });
}

async function loadConversation(partnerId) {
    if (!currentUserId || !partnerId) return;
    var response = await apiFetch('/chats/' + partnerId + '/messages?userId=' + currentUserId, { method: 'GET' });
    if (!response) return;
    var payload = await response.json().catch(function() { return []; });
    currentConversationMessages = Array.isArray(payload) ? payload : [];
    renderChatMessages(currentConversationMessages);
}

async function sendChatMessage(partnerId, content) {
    if (!stompClient || !stompClient.connected) { showDashboardNotice('Connexion WebSocket perdue. Rechargez la page.'); return; }
    stompClient.send('/app/chat', {}, JSON.stringify({ senderId: currentUserId, receiverId: Number(partnerId), content: content }));
}

// ── Nearby map ────────────────────────────────────────────────

function renderMedicalMap(places, userLat, userLng) {
    var mapEl = document.getElementById('nearby-map');
    if (!mapEl) return;
    mapEl.style.display = 'block';
    if (nearbyMap) {
        nearbyMapMarkers.forEach(function(m) { nearbyMap.removeLayer(m); });
        nearbyMapMarkers = [];
        nearbyMap.setView([userLat, userLng], 14);
    } else {
        nearbyMap = L.map('nearby-map').setView([userLat, userLng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap' }).addTo(nearbyMap);
    }
    var userIcon = L.divIcon({ html: '<div style="background:#0d6efd;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>', className: '', iconAnchor: [7,7] });
    nearbyMapMarkers.push(L.marker([userLat, userLng], { icon: userIcon }).addTo(nearbyMap).bindPopup('<b>Votre position</b>'));
    var typeColors = { 'Pharmacie':'#198754', 'Hopital':'#dc3545', 'Clinique':'#fd7e14', 'Cabinet medical':'#0d6efd' };
    places.forEach(function(place) {
        if (!place.lat || !place.lon) return;
        var color = typeColors[place.type] || '#6c757d';
        var icon = L.divIcon({ html: '<div style="background:' + color + ';width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3)"></div>', className: '', iconAnchor: [6,6] });
        nearbyMapMarkers.push(L.marker([place.lat, place.lon], { icon: icon }).addTo(nearbyMap).bindPopup('<b>' + place.name + '</b><br><small>' + place.type + '</small>'));
    });
    setTimeout(function() { nearbyMap.invalidateSize(); }, 100);
}

function renderMedicalResults(places) {
    var grid = document.getElementById('medical-results-grid');
    if (!grid) return;
    if (!places.length) { grid.innerHTML = '<div class="medical-empty-state">Aucun etablissement trouve.</div>'; return; }
    grid.innerHTML = places.slice(0, 8).map(function(p) {
        var addr = [p.street, p.city].filter(Boolean).join(', ') || 'Adresse non disponible';
        return '<article class="medical-place-card"><div><h6 class="fw-bold mb-1">' + p.name + '</h6><div class="medical-place-meta">' + (p.type || '') + '</div><div class="medical-place-meta mt-1">' + addr + '</div></div><span class="badge bg-primary-subtle text-primary medical-distance-badge">' + (p.distance != null ? p.distance + ' m' : '-') + '</span></article>';
    }).join('');
}

async function findNearbyMedicalPlaces(position) {
    var statusEl = document.getElementById('medical-location-status');
    var gridEl   = document.getElementById('medical-results-grid');
    if (statusEl) statusEl.textContent = 'Recherche des services medicaux proches...';
    if (gridEl)   gridEl.innerHTML     = '<div class="medical-empty-state">Chargement...</div>';
    var lat = position.coords.latitude, lng = position.coords.longitude;
    try {
        var res = await apiFetch('/nearby-medical?lat=' + lat + '&lng=' + lng + '&radius=' + searchRadiusMeters, { method: 'GET' });
        if (!res) return;
        var data = await res.json().catch(function() { return {}; });
        if (!res.ok) throw new Error(data.message || 'La recherche a echoue.');
        var places = Array.isArray(data) ? data : data.items || [];
        if (statusEl) statusEl.textContent = places.length + ' resultat(s) trouve(s).';
        renderMedicalResults(places);
        renderMedicalMap(places, lat, lng);
    } catch (err) {
        if (statusEl) statusEl.textContent = err.message;
        if (gridEl)   gridEl.innerHTML = '<div class="medical-empty-state">Reessayez plus tard.</div>';
    }
}

function locateMedicalPlaces() {
    var statusEl = document.getElementById('medical-location-status');
    if (!navigator.geolocation) {
        if (statusEl) statusEl.textContent = 'Geolocalisation non disponible. Utilisation de Tunis.';
        findNearbyMedicalPlaces({ coords: { latitude: TUNIS_FALLBACK_LAT, longitude: TUNIS_FALLBACK_LNG } });
        return;
    }
    navigator.geolocation.getCurrentPosition(
        function(pos) { findNearbyMedicalPlaces(pos); },
        function() {
            if (statusEl) statusEl.textContent = 'Permission refusee. Utilisation de Tunis.';
            findNearbyMedicalPlaces({ coords: { latitude: TUNIS_FALLBACK_LAT, longitude: TUNIS_FALLBACK_LNG } });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
}

// ── Patient action buttons ────────────────────────────────────

function handleAction(action) {
    var sv = document.getElementById('doctor-summary-view');
    var cv = document.getElementById('chat-view');
    if (action === 'BackToSummary') { if (sv) sv.classList.remove('d-none'); if (cv) cv.classList.add('d-none'); return; }
    if (!currentPartnerId) { showDashboardNotice("Selectionnez un medecin d'abord."); return; }
    if (action === 'Message Direct') {
        if (sv) sv.classList.add('d-none');
        if (cv) cv.classList.remove('d-none');
        loadConversation(currentPartnerId);
        return;
    }
    if (action === 'Consultation Vidéo') showDashboardNotice('Demande de consultation envoyee.');
}
window.handleAction = handleAction;

// ── Init ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('.app-wrapper')) return;

    var user = getCurrentUser();
    if (!user) { window.location.href = 'login.html'; return; }
    if ((user.role || '').toUpperCase() === 'ADMIN') { window.location.href = 'admin.html'; return; }

    currentUserId = user.id;

    var logoutLink = document.getElementById('logout-link');
    if (logoutLink) logoutLink.addEventListener('click', clearSession);

    var emergencyBtn = document.getElementById('emergency-btn');
    var emergencyEl  = document.getElementById('emergencyModal');
    if (emergencyBtn && emergencyEl) { var modal = new bootstrap.Modal(emergencyEl); emergencyBtn.addEventListener('click', function() { modal.show(); }); }

    var chatInput   = document.getElementById('chat-input-field');
    var chatSendBtn = document.getElementById('chat-send-btn');
    if (chatSendBtn && chatInput) {
        var sendMessage = async function() {
            var text = chatInput.value.trim();
            if (!text || !currentPartnerId) return;
            try { await sendChatMessage(currentPartnerId, text); chatInput.value = ''; }
            catch (err) { showDashboardNotice(err.message); }
        };
        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });
    }

    var locateBtn = document.getElementById('locate-medical-btn');
    if (locateBtn) locateBtn.addEventListener('click', locateMedicalPlaces);

    var uploadBtn   = document.getElementById('medical-upload-btn');
    var uploadInput = document.getElementById('medical-file-upload');
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', function() { uploadInput.click(); });
        uploadInput.addEventListener('change', async function() {
            if (!uploadInput.files.length) return;
            try {
                for (var i = 0; i < uploadInput.files.length; i++) {
                    var fd = new FormData(); fd.append('file', uploadInput.files[i]);
                    var res = await apiFetch('/patients/' + currentUserId + '/medical-files', { method: 'POST', body: fd });
                    if (!res) return;
                    if (!res.ok) throw new Error((await res.json().catch(function(){return{};})).message || 'Upload impossible.');
                }
                showDashboardNotice('Fichier(s) envoye(s) avec succes.');
                await loadMedicalFiles();
            } catch (err) { showDashboardNotice(err.message); }
            finally { uploadInput.value = ''; }
        });
    }

    connectWebSocket(currentUserId);

    var role = (user.role || '').toUpperCase();
    if (role === 'DOCTOR') {
        initDoctorMode(user);
    } else {
        attachBookingForm();
        Promise.all([loadDoctors(), loadMedicalFiles()]).catch(function(err) {
            showDashboardNotice(err.message || 'Impossible de charger vos donnees.');
        });
    }
});
