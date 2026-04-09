const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8080/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';
const REFRESH_TOKEN_KEY = 'tbibi_refresh_token';
const searchRadiusMeters = 3000;

let doctorsCache = [];
let currentDoctorId = null;
let currentConversationMessages = [];
let lastMedicalBlobUrl = null;

function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('tbibi_session');
    localStorage.removeItem('tbibi_user');
}

async function apiFetch(path, options = {}) {
    const token = getAccessToken();
    const headers = {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        clearSession();
        window.location.href = 'login.html';
        throw new Error('Session expirée.');
    }

    return response;
}

function showDashboardNotice(message) {
    const el = document.getElementById('dashboard-toast');
    const body = document.getElementById('dashboard-toast-body');
    if (!el || !body) {
        return;
    }
    body.textContent = message;
    const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 4500 });
    t.show();
}

function resolveAvatarUrl(d) {
    if (!d || !d.avatarUrl) {
        return '../assets/logo.png';
    }
    return d.avatarUrl;
}

function formatExperienceYears(years) {
    if (years == null || years === '') {
        return 'Expérience non renseignée';
    }
    return `${years} ans d'expérience`;
}

function doctorDisplayName(d) {
    const first = d.firstName || '';
    const last = d.lastName || '';
    return `Dr. ${first} ${last}`.trim();
}

function normalizeDoctor(dto) {
    return {
        id: dto.id,
        firstName: dto.firstName || dto.givenName || '',
        lastName: dto.lastName || dto.familyName || '',
        specialty: dto.specialty || dto.speciality || '—',
        experienceYears: dto.experienceYears ?? dto.yearsOfExperience ?? null,
        bio: dto.bio || dto.description || '',
        isOnline: Boolean(dto.isOnline),
        avatarUrl: dto.avatarUrl || dto.avatar || '../assets/logo.png'
    };
}

function updateDoctorView(doctorId) {
    const doctor = doctorsCache.find((x) => String(x.id) === String(doctorId));
    if (!doctor) {
        return;
    }

    const title = document.getElementById('doctor-title');
    const avatar = document.getElementById('doctor-avatar-summary');
    const specialty = document.getElementById('doctor-specialty');
    const status = document.getElementById('doctor-status');
    const experience = document.getElementById('doctor-experience');
    const description = document.getElementById('doctor-description');

    const name = doctorDisplayName(doctor);
    const online = doctor.isOnline === true;
    const statusLabel = online ? 'En ligne' : 'Hors ligne';

    if (title) title.textContent = name;
    if (avatar) {
        avatar.src = resolveAvatarUrl(doctor);
        avatar.alt = name;
    }
    if (specialty) specialty.textContent = doctor.specialty || '—';
    if (experience) experience.textContent = formatExperienceYears(doctor.experienceYears);
    if (description) description.textContent = doctor.bio || 'Aucune description disponible.';

    if (status) {
        status.textContent = statusLabel;
        status.className = `badge ${online ? 'bg-success' : 'bg-secondary'}`;
    }

    const chatDoctorName = document.getElementById('chat-doctor-name');
    if (chatDoctorName) {
        chatDoctorName.textContent = name;
    }
}

function renderDoctorList() {
    const container = document.getElementById('doctor-list-container');
    if (!container) {
        return;
    }

    const placeholder = document.getElementById('doctor-list-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const actionAnchor = container.querySelector('[data-action="reports"]');

    container.querySelectorAll('.doctor-nav-card[data-doctor-id]').forEach((el) => el.remove());

    doctorsCache.forEach((doctor) => {
        const card = document.createElement('div');
        card.className = 'doctor-nav-card';
        card.setAttribute('data-doctor-id', String(doctor.id));
        const onlineClass = doctor.isOnline ? 'text-success' : 'text-secondary';
        card.innerHTML = `
            <img src="${resolveAvatarUrl(doctor)}" alt="${doctorDisplayName(doctor)}" class="doctor-avatar">
            <div class="ms-3 overflow-hidden">
                <span class="d-block fw-bold text-truncate">${doctorDisplayName(doctor)}</span>
                <small class="${onlineClass} text-truncate">${doctor.specialty || '—'}</small>
            </div>
        `;

        card.addEventListener('click', () => {
            container
                .querySelectorAll('.doctor-nav-card[data-doctor-id]')
                .forEach((c) => c.classList.remove('active-doctor'));
            card.classList.add('active-doctor');
            currentDoctorId = doctor.id;
            updateDoctorView(currentDoctorId);

            const chatView = document.getElementById('chat-view');
            const summaryView = document.getElementById('doctor-summary-view');
            if (chatView) chatView.classList.add('d-none');
            if (summaryView) summaryView.classList.remove('d-none');
        });

        if (actionAnchor) {
            container.insertBefore(card, actionAnchor);
        } else {
            container.appendChild(card);
        }
    });

    const firstCard = container.querySelector('.doctor-nav-card[data-doctor-id]');
    if (firstCard) {
        firstCard.classList.add('active-doctor');
        currentDoctorId = firstCard.getAttribute('data-doctor-id');
        updateDoctorView(currentDoctorId);
    }
}

async function loadDoctors() {
    const response = await apiFetch('/doctors', { method: 'GET' });
    const payload = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(payload.message || 'Impossible de charger les médecins.');
    }

    const raw = Array.isArray(payload) ? payload : payload.items || [];
    doctorsCache = raw.map(normalizeDoctor);
    renderDoctorList();
}

function normalizeMedicalFile(dto) {
    return {
        id: dto.id,
        name: dto.originalFileName || dto.fileName || dto.name || `Document ${dto.id}`,
        createdAt: dto.createdAt || dto.uploadedAt || null
    };
}

async function loadMedicalFiles() {
    const listEl = document.getElementById('file-history-list');
    const emptyEl = document.getElementById('file-history-empty');

    if (!listEl) {
        return;
    }

    const response = await apiFetch('/medical-files', { method: 'GET' });
    const payload = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(payload.message || 'Impossible de charger les fichiers médicaux.');
    }

    const files = (Array.isArray(payload) ? payload : payload.items || []).map(normalizeMedicalFile);

    listEl.querySelectorAll('[data-file-id]').forEach((el) => el.remove());

    if (!files.length) {
        if (emptyEl) {
            emptyEl.textContent = 'Aucun fichier pour le moment.';
            emptyEl.classList.remove('d-none');
        }
        return;
    }

    if (emptyEl) {
        emptyEl.classList.add('d-none');
    }

    files.forEach((file) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'd-flex justify-content-between align-items-center list-group-item list-group-item-action';
        a.setAttribute('data-file-id', String(file.id));
        a.innerHTML = `
            <span>${file.name}</span>
            <i class="bi bi-eye text-primary"></i>
        `;

        a.addEventListener('click', (event) => {
            event.preventDefault();
            loadFileById(file.id, file.name);
        });

        listEl.appendChild(a);
    });
}

async function loadFileById(fileId, fileName) {
    const iframe = document.getElementById('medical-file-iframe');
    const fileTitle = document.getElementById('current-file-title');

    if (!iframe || !fileTitle) {
        return;
    }

    const response = await apiFetch(`/medical-files/${fileId}/download`, { method: 'GET' });
    if (!response.ok) {
        throw new Error('Impossible de charger le document.');
    }

    const blob = await response.blob();

    if (lastMedicalBlobUrl) {
        URL.revokeObjectURL(lastMedicalBlobUrl);
    }

    lastMedicalBlobUrl = URL.createObjectURL(blob);
    iframe.src = lastMedicalBlobUrl;
    fileTitle.textContent = fileName || `Document ${fileId}`;
}

function renderChatMessages(messages) {
    const chatMessagesContainer = document.querySelector('.chat-messages-container');
    if (!chatMessagesContainer) {
        return;
    }

    chatMessagesContainer.innerHTML = '';

    messages.forEach((message) => {
        const msg = document.createElement('div');
        const mine = message.senderRole === 'PATIENT' || message.mine === true;
        msg.className = `message ${mine ? 'patient-message' : 'doctor-message'}`;
        msg.textContent = message.content || '';
        chatMessagesContainer.appendChild(msg);
    });

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

async function loadConversation(doctorId) {
    const response = await apiFetch(`/chats/${doctorId}/messages`, { method: 'GET' });
    const payload = await response.json().catch(() => []);

    if (!response.ok) {
        throw new Error(payload.message || 'Impossible de charger les messages.');
    }

    currentConversationMessages = Array.isArray(payload) ? payload : payload.items || [];
    renderChatMessages(currentConversationMessages);
}

async function sendChatMessage(doctorId, content) {
    const response = await apiFetch(`/chats/${doctorId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || 'Envoi du message impossible.');
    }

    const posted = payload && payload.id ? payload : null;
    if (posted) {
        currentConversationMessages.push(posted);
        renderChatMessages(currentConversationMessages);
    } else {
        await loadConversation(doctorId);
    }
}

function renderMedicalResults(places) {
    const resultsGrid = document.getElementById('medical-results-grid');
    if (!resultsGrid) {
        return;
    }

    if (!places.length) {
        resultsGrid.innerHTML =
            '<div class="medical-empty-state">Aucun établissement trouvé dans ce rayon.</div>';
        return;
    }

    resultsGrid.innerHTML = places
        .slice(0, 8)
        .map((place) => {
            const addressParts = [place.street, place.city].filter(Boolean);
            const address = addressParts.length
                ? addressParts.join(', ')
                : 'Adresse non disponible';
            const dist = place.distance != null ? `${place.distance} m` : '—';

            return `
            <article class="medical-place-card">
                <div>
                    <h6 class="fw-bold mb-1">${place.name}</h6>
                    <div class="medical-place-meta">${place.type || ''}</div>
                    <div class="medical-place-meta mt-1">${address}</div>
                </div>
                <span class="badge bg-primary-subtle text-primary medical-distance-badge">${dist}</span>
            </article>
        `;
        })
        .join('');
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

function mapOverpassToPlaces(elements, centerLat, centerLng) {
    const out = [];
    const seen = new Set();

    for (const el of elements) {
        if (!el.tags) continue;
        const lat = el.lat != null ? el.lat : el.center?.lat;
        const lon = el.lon != null ? el.lon : el.center?.lon;
        if (lat == null || lon == null) continue;

        const key = `${lat.toFixed(5)},${lon.toFixed(5)},${el.tags.name || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const amenity = el.tags.amenity || el.tags.healthcare || '';
        const name =
            el.tags.name ||
            el.tags['name:fr'] ||
            (amenity === 'pharmacy' ? 'Pharmacie' : 'Établissement de santé');

        out.push({
            name,
            type: amenity,
            street: el.tags['addr:street'] || '',
            city: el.tags['addr:city'] || el.tags['addr:place'] || '',
            distance: haversineMeters(centerLat, centerLng, lat, lon)
        });
    }

    out.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return out;
}

async function findNearbyMedicalPlaces(position) {
    const locationStatus = document.getElementById('medical-location-status');
    const resultsGrid = document.getElementById('medical-results-grid');

    if (locationStatus) {
        locationStatus.textContent = 'Recherche des services médicaux proches...';
    }
    if (resultsGrid) {
        resultsGrid.innerHTML =
            '<div class="medical-empty-state">Chargement des résultats...</div>';
    }

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    const overpassEndpoint = 'https://overpass-api.de/api/interpreter';
    const q = `
[out:json][timeout:25];
(
  node["amenity"="hospital"](around:${searchRadiusMeters},${latitude},${longitude});
  node["amenity"="clinic"](around:${searchRadiusMeters},${latitude},${longitude});
  node["amenity"="doctors"](around:${searchRadiusMeters},${latitude},${longitude});
  node["amenity"="pharmacy"](around:${searchRadiusMeters},${latitude},${longitude});
  node["healthcare"="hospital"](around:${searchRadiusMeters},${latitude},${longitude});
);
out center;
`.trim();

    try {
        const res = await fetch(overpassEndpoint, {
            method: 'POST',
            body: `data=${encodeURIComponent(q)}`
        });
        if (!res.ok) {
            throw new Error('La requête Overpass a échoué.');
        }
        const data = await res.json();
        const places = mapOverpassToPlaces(data.elements || [], latitude, longitude);
        if (locationStatus) {
            locationStatus.textContent = `Position trouvée. ${places.length} résultat(s) (OpenStreetMap / Overpass).`;
        }
        renderMedicalResults(places);
    } catch (e) {
        if (locationStatus) {
            locationStatus.textContent =
                e.message || 'Impossible de contacter le service de cartographie.';
        }
        if (resultsGrid) {
            resultsGrid.innerHTML =
                '<div class="medical-empty-state">Vérifiez la connexion ou réessayez plus tard.</div>';
        }
    }
}

function locateMedicalPlaces() {
    const locationStatus = document.getElementById('medical-location-status');

    if (!navigator.geolocation) {
        if (locationStatus) {
            locationStatus.textContent =
                'La géolocalisation n’est pas disponible dans ce navigateur.';
        }
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => findNearbyMedicalPlaces(position),
        () => {
            if (locationStatus) {
                locationStatus.textContent =
                    'Autorisation refusée ou indisponible. Activez la géolocalisation pour voir les établissements proches.';
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60000
        }
    );
}

function handleAction(action) {
    const summaryView = document.getElementById('doctor-summary-view');
    const chatView = document.getElementById('chat-view');

    if (!currentDoctorId) {
        return;
    }

    if (action === 'Message Direct') {
        if (summaryView) summaryView.classList.add('d-none');
        if (chatView) chatView.classList.remove('d-none');

        loadConversation(currentDoctorId).catch((error) => {
            showDashboardNotice(error.message || 'Impossible de charger la conversation.');
        });
        return;
    }

    if (action === 'BackToSummary') {
        if (summaryView) summaryView.classList.remove('d-none');
        if (chatView) chatView.classList.add('d-none');
        return;
    }

    if (action === 'Consultation Vidéo') {
        showDashboardNotice('Demande de consultation envoyée.');
    }
}

window.handleAction = handleAction;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.app-wrapper')) {
        return;
    }

    const logout = document.getElementById('logout-link');
    if (logout) {
        logout.addEventListener('click', () => {
            clearSession();
        });
    }

    const uploadBtn = document.getElementById('medical-upload-btn');
    const uploadInput = document.getElementById('medical-file-upload');
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', async () => {
            if (!uploadInput.files.length) {
                return;
            }

            const formData = new FormData();
            [...uploadInput.files].forEach((file) => {
                formData.append('files', file);
            });

            try {
                const response = await apiFetch('/medical-files', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.message || 'Upload impossible.');
                }

                showDashboardNotice('Fichier(s) envoyé(s) avec succès.');
                await loadMedicalFiles();
            } catch (error) {
                showDashboardNotice(error.message || 'Erreur lors de l\'upload.');
            } finally {
                uploadInput.value = '';
            }
        });
    }

    const emergencyBtn = document.getElementById('emergency-btn');
    const emergencyModalElement = document.getElementById('emergencyModal');
    if (emergencyBtn && emergencyModalElement) {
        const emergencyModal = new bootstrap.Modal(emergencyModalElement);
        emergencyBtn.addEventListener('click', () => emergencyModal.show());
    }

    const chatInputField = document.getElementById('chat-input-field');
    const chatSendBtn = document.getElementById('chat-send-btn');
    if (chatSendBtn && chatInputField) {
        const send = async () => {
            const messageText = chatInputField.value.trim();
            if (!messageText || !currentDoctorId) {
                return;
            }

            try {
                await sendChatMessage(currentDoctorId, messageText);
                chatInputField.value = '';
            } catch (error) {
                showDashboardNotice(error.message || 'Erreur lors de l\'envoi du message.');
            }
        };

        chatSendBtn.addEventListener('click', send);
        chatInputField.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                send();
            }
        });
    }

    const locateMedicalBtn = document.getElementById('locate-medical-btn');
    if (locateMedicalBtn) {
        locateMedicalBtn.addEventListener('click', locateMedicalPlaces);
    }

    Promise.all([loadDoctors(), loadMedicalFiles()]).catch((error) => {
        showDashboardNotice(error.message || 'Impossible de charger vos données.');
    });
});
