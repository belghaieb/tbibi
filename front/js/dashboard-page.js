const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';
const REFRESH_TOKEN_KEY = 'tbibi_refresh_token';
let _agendaDoctorId = null;
let _agendaWeekStart = null;

let doctorsCache = [];
let currentDoctorId = null;
let currentChatPartnerId = null; // overrides currentDoctorId for doctor→patient chat
let currentViewedPatient = null; // { id, name } — last patient whose files were open (doctor scope)
let currentConversationMessages = [];
let lastMedicalBlobUrl = null;
let currentPatientId = null;

function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

function clearSession() {
    localStorage.clear();
}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('tbibi_user');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function resolveCurrentPatientId() {
    if (currentPatientId) {
        return currentPatientId;
    }

    const user = getCurrentUser();
    const resolvedId = user?.id ?? user?.userId ?? user?.patientId ?? null;
    if (resolvedId != null) {
        currentPatientId = resolvedId;
    }

    return currentPatientId;
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
        return null;
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
        return '../assets/logo.jpg';
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
        avatarUrl: dto.avatarUrl || dto.avatar || '../assets/logo.jpg'
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

    // Refresh the agenda tab if it is currently visible
    const agendaTab = document.getElementById('ptab-nearby');
    if (agendaTab && !agendaTab.classList.contains('d-none')) {
        showDoctorAgenda(doctorId, getWeekMonday(new Date()));
    }
}

// ── Doctor availability calendar ──────────────────────────────────
let _availCalDoctorId = null;
let _availCalDate = null;

async function showDoctorCalendar(doctorId, dateStr) {
    const calEl = document.getElementById('doctor-availability-calendar');
    if (!calEl) return;

    _availCalDoctorId = doctorId;
    if (!dateStr) {
        const today = new Date();
        // Skip to Monday if weekend
        const day = today.getDay();
        if (day === 0) today.setDate(today.getDate() + 1);
        if (day === 6) today.setDate(today.getDate() + 2);
        dateStr = today.toISOString().split('T')[0];
    }
    _availCalDate = dateStr;

    calEl.classList.remove('d-none');

    // Update date label
    const labelEl = document.getElementById('avail-cal-date-label');
    if (labelEl) {
        const d = new Date(dateStr + 'T00:00:00');
        labelEl.textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    // Wire nav buttons (replace onclick each call)
    const prevBtn = document.getElementById('avail-prev-btn');
    const nextBtn = document.getElementById('avail-next-btn');
    if (prevBtn) prevBtn.onclick = () => {
        const d = new Date(_availCalDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        showDoctorCalendar(_availCalDoctorId, d.toISOString().split('T')[0]);
    };
    if (nextBtn) nextBtn.onclick = () => {
        const d = new Date(_availCalDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        showDoctorCalendar(_availCalDoctorId, d.toISOString().split('T')[0]);
    };

    // Fetch booked slots
    const slotsEl = document.getElementById('avail-cal-slots');
    if (!slotsEl) return;
    slotsEl.innerHTML = '<span class="avail-cal-loading"><span class="spinner-border spinner-border-sm me-1"></span>Chargement…</span>';

    let bookedSlots = [];
    try {
        const res = await apiFetch(`/appointments/doctor/${doctorId}/slots?date=${dateStr}`, { method: 'GET' });
        if (res && res.ok) {
            const raw = await res.json().catch(() => []);
            bookedSlots = Array.isArray(raw) ? raw : [];
        }
    } catch (_) { /* ignore — show all as free */ }

    slotsEl.innerHTML = '';
    BOOKING_SLOTS.forEach((slot) => {
        const taken = bookedSlots.includes(slot);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `avail-slot ${taken ? 'taken' : 'free'}`;
        btn.textContent = slot;
        if (!taken) {
            btn.addEventListener('click', () => {
                openBookingModal(_availCalDoctorId, _availCalDate).then(() => {
                    // After modal opens, select this slot automatically
                    setTimeout(() => {
                        const target = document.querySelector(`.booking-slot-btn[data-time="${slot}"]`);
                        if (target) target.click();
                    }, 100);
                });
            });
        }
        slotsEl.appendChild(btn);
    });
}

function renderDoctorList() {
    const container = document.getElementById('doctor-list-container');
    if (!container) {
        return;
    }

    const placeholder = document.getElementById('doctor-list-placeholder');

    // No verified doctors available — show a message instead of staying on "Chargement…"
    if (!doctorsCache.length) {
        if (placeholder) {
            placeholder.innerHTML = '<div class="text-muted small text-center py-2">Aucun médecin disponible pour le moment.</div>';
        }
        const title = document.getElementById('doctor-title');
        const specialty = document.getElementById('doctor-specialty');
        const status = document.getElementById('doctor-status');
        const experience = document.getElementById('doctor-experience');
        if (title) title.textContent = 'Aucun médecin';
        if (specialty) specialty.textContent = '—';
        if (status) { status.textContent = '—'; status.className = 'badge badge-status'; }
        if (experience) experience.textContent = '—';
        return;
    }

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
    let response;
    try {
        response = await apiFetch('/doctors', { method: 'GET' });
    } catch (networkError) {
        console.error('[loadDoctors] network error:', networkError);
        throw new Error('Backend injoignable (http://localhost:8084). Démarrez le serveur Spring Boot.');
    }
    if (!response) {
        return;
    }
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error('[loadDoctors] backend returned', response.status, payload);
        throw new Error(payload.message || `Erreur backend ${response.status} sur /api/doctors.`);
    }

    const raw = Array.isArray(payload) ? payload : payload.items || [];
    console.log('[loadDoctors] got', raw.length, 'doctor(s)');
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

    const patientId = resolveCurrentPatientId();
    if (!patientId) {
        throw new Error('Impossible de déterminer votre identifiant patient.');
    }

    const response = await apiFetch(`/patients/${patientId}/medical-files`, { method: 'GET' });
    if (!response) {
        return;
    }
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
        const item = document.createElement('div');
        item.className = 'd-flex justify-content-between align-items-center list-group-item list-group-item-action';
        item.setAttribute('data-file-id', String(file.id));
        item.innerHTML = `
            <div>
                <span class="d-block">${file.name}</span>
                <small class="text-muted">${file.createdAt || ''}</small>
            </div>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-primary" data-action="view">Voir</button>
                <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete">Supprimer</button>
            </div>
        `;

        item.querySelector('[data-action="view"]')?.addEventListener('click', () => {
            loadFileById(file.id, file.name);
        });

        const deleteBtn = item.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                // First click → show inline confirm
                if (!deleteBtn.dataset.confirming) {
                    deleteBtn.dataset.confirming = '1';
                    deleteBtn.textContent = 'Confirmer ?';
                    deleteBtn.classList.replace('btn-outline-danger', 'btn-danger');
                    // Auto-reset after 3s if user changes mind
                    setTimeout(() => {
                        if (deleteBtn.dataset.confirming) {
                            delete deleteBtn.dataset.confirming;
                            deleteBtn.textContent = 'Supprimer';
                            deleteBtn.classList.replace('btn-danger', 'btn-outline-danger');
                        }
                    }, 3000);
                    return;
                }
                // Second click → do the delete
                delete deleteBtn.dataset.confirming;
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

                // Close the iframe viewer first to release the Windows file lock
                const iframeEl = document.getElementById('medical-file-iframe');
                const viewerBox = document.getElementById('file-viewer-box');
                if (iframeEl) iframeEl.src = 'about:blank';
                if (viewerBox) viewerBox.style.display = 'none';

                apiFetch(`/patients/${patientId}/medical-files/${file.id}`, { method: 'DELETE' })
                    .then(async (res) => {
                        if (!res) return;
                        if (!res.ok) {
                            const payload = await res.json().catch(() => ({}));
                            throw new Error(payload.message || 'Suppression impossible.');
                        }
                        showDashboardNotice('Fichier supprimé.');
                        await loadMedicalFiles();
                    })
                    .catch((err) => {
                        showDashboardNotice(err.message || 'Erreur lors de la suppression.');
                        deleteBtn.disabled = false;
                        deleteBtn.textContent = 'Supprimer';
                        deleteBtn.classList.replace('btn-danger', 'btn-outline-danger');
                    });
            });
        }

        listEl.appendChild(item);
    });
}

async function loadFileById(fileId, fileName) {
    const iframe = document.getElementById('medical-file-iframe');
    const fileTitle = document.getElementById('current-file-title');

    if (!iframe || !fileTitle) {
        return;
    }

    const patientId = resolveCurrentPatientId();
    if (!patientId) {
        throw new Error('Impossible de déterminer votre identifiant patient.');
    }

    const response = await apiFetch(`/patients/${patientId}/medical-files/${fileId}/download`, { method: 'GET' });
    if (!response) {
        return;
    }
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
    const viewerBox = document.getElementById('file-viewer-box');
    if (viewerBox) viewerBox.style.display = '';
}

function renderChatMessages(messages) {
    const chatMessagesContainer = document.querySelector('.chat-messages-container');
    if (!chatMessagesContainer) return;
    chatMessagesContainer.innerHTML = '';
    messages.forEach((message) => {
        const mine = message.mine === true;
        const wrapper = document.createElement('div');
        wrapper.className = `message ${mine ? 'patient-message' : 'doctor-message'}`;
        if (message.imageUrl) {
            const img = document.createElement('img');
            img.src = message.imageUrl;
            img.alt = 'Image';
            img.style.cssText = 'max-width:220px;max-height:220px;border-radius:8px;display:block;cursor:pointer;';
            img.addEventListener('click', () => window.open(message.imageUrl, '_blank'));
            wrapper.appendChild(img);
            if (message.content) {
                const txt = document.createElement('div');
                txt.style.marginTop = '4px';
                txt.textContent = message.content;
                wrapper.appendChild(txt);
            }
        } else {
            wrapper.textContent = message.content || '';
        }
        chatMessagesContainer.appendChild(wrapper);
    });
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

async function loadConversation(partnerId) {
    const user = getCurrentUser();
    const userId = user ? user.id : null;
    if (!userId || !partnerId) return;
    const response = await apiFetch(`/chats/${partnerId}/messages?userId=${userId}`, { method: 'GET' });
    if (!response) return;
    const payload = await response.json().catch(() => []);
    if (!response.ok) throw new Error(payload.message || 'Impossible de charger les messages.');
    currentConversationMessages = Array.isArray(payload) ? payload : payload.items || [];
    renderChatMessages(currentConversationMessages);
}

async function sendChatMessage(partnerId, content, imageUrl) {
    const user = getCurrentUser();
    const userId = user ? user.id : null;
    if (!userId || !partnerId) return;
    const body = { content: content || '' };
    if (imageUrl) body.imageUrl = imageUrl;
    const response = await apiFetch(`/chats/${partnerId}/messages?userId=${userId}`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    if (!response) return;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Envoi du message impossible.');
    if (payload && payload.id) {
        currentConversationMessages.push(payload);
        renderChatMessages(currentConversationMessages);
    }
}

// ── Doctor: patient file panel ─────────────────────────────────

async function showPatientFilesInPanel(patientId, patientName) {
    const area = document.querySelector('.file-viewer-area');
    if (!area) return;
    currentViewedPatient = { id: patientId, name: patientName };

    area.innerHTML =
        '<input type="file" id="dr-upload-input" accept=".pdf,.jpg,.jpeg,.png,.dcm" style="display:none">' +
        '<div class="d-flex align-items-center gap-2 mb-2 flex-wrap">' +
        '<button class="btn btn-sm btn-outline-secondary" onclick="restoreAppointmentsPanel()"><i class="bi bi-arrow-left me-1"></i>Rendez-vous</button>' +
        '<h5 class="fw-bold mb-0 me-auto text-truncate"><i class="bi bi-folder2-open me-1 text-primary"></i>' + (patientName || 'Patient') + '</h5>' +
        '<button class="btn btn-sm btn-outline-primary" id="dr-chat-btn"><i class="bi bi-chat-left-text-fill me-1"></i>Discuter</button>' +
        '<button class="btn btn-sm btn-primary" id="dr-upload-btn"><i class="bi bi-upload me-1"></i>Ajouter</button>' +
        '<button class="btn btn-sm btn-success" id="dr-ordo-btn"><i class="bi bi-file-earmark-plus me-1"></i>Ordonnance</button>' +
        '</div>' +
        '<div id="dr-ordo-editor" style="display:none;" class="border rounded p-3 mb-3 bg-light">' +
        '<h6 class="fw-bold mb-3"><i class="bi bi-file-earmark-medical me-1 text-success"></i>Nouvelle ordonnance</h6>' +
        '<div class="mb-2"><label class="form-label small fw-semibold mb-1">Médicaments / Instructions</label>' +
        '<textarea id="dr-ordo-content" class="form-control" rows="6" placeholder="Ex:\n- Amoxicilline 500mg — 3x/jour pendant 7 jours\n- Ibuprofène 400mg — si douleur\n- Repos complet 3 jours"></textarea></div>' +
        '<div class="mb-2"><label class="form-label small fw-semibold mb-1">Notes complémentaires</label>' +
        '<input type="text" id="dr-ordo-notes" class="form-control" placeholder="Ex: À revoir dans 2 semaines"></div>' +
        '<div class="d-flex gap-2">' +
        '<button class="btn btn-success btn-sm" id="dr-ordo-save"><i class="bi bi-check-lg me-1"></i>Sauvegarder</button>' +
        '<button class="btn btn-outline-secondary btn-sm" id="dr-ordo-cancel">Annuler</button>' +
        '</div></div>' +
        '<div id="patient-files-panel"><div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Chargement...</div></div>';


    const chatBtn = document.getElementById('dr-chat-btn');
    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            currentChatPartnerId = patientId;
            const chatView    = document.getElementById('chat-view');
            const summaryView = document.getElementById('doctor-summary-view');
            const nameEl      = document.getElementById('chat-doctor-name');
            if (nameEl) nameEl.textContent = patientName || 'Patient';
            if (summaryView) summaryView.style.display = 'none';
            if (chatView) chatView.classList.remove('d-none');
            loadConversation(patientId).catch(() => {});
        });
    }

    const uploadBtn   = document.getElementById('dr-upload-btn');
    const uploadInput = document.getElementById('dr-upload-input');
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', async () => {
            const file = uploadInput.files[0];
            if (!file) return;
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            try {
                const user = getCurrentUser();
                const form = new FormData();
                form.append('file', file);
                form.append('category', 'OTHER');
                if (user && user.id) form.append('uploadedById', String(user.id));
                const res = await apiFetch('/patients/' + patientId + '/medical-files', { method: 'POST', body: form });
                if (res && res.ok) {
                    showDashboardNotice('Fichier ajouté avec succès.');
                    await reloadPatientFilesList(patientId, patientName);
                } else { showDashboardNotice('Erreur lors de l\'envoi du fichier.'); }
            } catch (e) { showDashboardNotice(e.message); }
            finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="bi bi-upload me-1"></i>Ajouter';
                uploadInput.value = '';
            }
        });
    }

    const ordoBtn    = document.getElementById('dr-ordo-btn');
    const ordoEditor = document.getElementById('dr-ordo-editor');
    const ordoCancel = document.getElementById('dr-ordo-cancel');
    const ordoSave   = document.getElementById('dr-ordo-save');

    ordoBtn?.addEventListener('click', () => {
        ordoEditor.style.display = ordoEditor.style.display === 'none' ? '' : 'none';
    });
    ordoCancel?.addEventListener('click', () => {
        ordoEditor.style.display = 'none';
        document.getElementById('dr-ordo-content').value = '';
        document.getElementById('dr-ordo-notes').value   = '';
    });
    ordoSave?.addEventListener('click', async () => {
        const content = document.getElementById('dr-ordo-content').value.trim();
        if (!content) { showDashboardNotice('Le contenu ne peut pas être vide.'); return; }
        const notes     = document.getElementById('dr-ordo-notes').value.trim();
        const user      = getCurrentUser();
        const doctorName = user ? (user.firstName + ' ' + user.lastName) : 'Médecin';
        const today     = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1f2937}
.header{border-bottom:3px solid #0068c9;padding-bottom:16px;margin-bottom:24px}
.logo{font-size:1.8rem;font-weight:800;color:#0068c9;letter-spacing:2px}
.title{text-align:center;font-size:1.3rem;font-weight:700;margin:20px 0;text-transform:uppercase}
.patient{background:#f0f9ff;border-left:4px solid #0068c9;padding:10px 14px;margin-bottom:20px;border-radius:0 6px 6px 0}
.content{white-space:pre-wrap;line-height:1.8;background:#fafafa;padding:16px;border-radius:8px;border:1px solid #e5e7eb}
.notes{margin-top:16px;font-size:.9rem;color:#6b7280;font-style:italic}
.footer{margin-top:40px;border-top:1px solid #e5e7eb;padding-top:16px;display:flex;justify-content:space-between;font-size:.85rem;color:#9ca3af}
.sig{text-align:right;margin-top:8px;font-weight:600;color:#1f2937}</style></head><body>
<div class="header"><div class="logo">TBIBI</div><div>Dr. ${doctorName}</div></div>
<div class="title">Ordonnance Médicale</div>
<div class="patient"><strong>Patient :</strong> ${patientName || 'Patient'}<br><strong>Date :</strong> ${today}</div>
<div class="content">${content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
${notes ? `<div class="notes">Note : ${notes}</div>` : ''}
<div class="footer"><span>TBIBI — Clinique Virtuelle</span><span>${today}</span></div>
<div class="sig">Dr. ${doctorName}</div></body></html>`;

        const blob     = new Blob([html], { type: 'text/html' });
        const fileName = 'Ordonnance_' + today.replace(/ /g, '_') + '.html';
        const fileObj  = new File([blob], fileName, { type: 'text/html' });
        ordoSave.disabled = true;
        ordoSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        try {
            const form = new FormData();
            form.append('file', fileObj);
            form.append('category', 'PRESCRIPTION');
            if (user && user.id) form.append('uploadedById', String(user.id));
            const res = await apiFetch('/patients/' + patientId + '/medical-files', { method: 'POST', body: form });
            if (res && res.ok) {
                showDashboardNotice('Ordonnance sauvegardée.');
                ordoEditor.style.display = 'none';
                document.getElementById('dr-ordo-content').value = '';
                document.getElementById('dr-ordo-notes').value   = '';
                await reloadPatientFilesList(patientId, patientName);
            } else { showDashboardNotice('Erreur lors de la sauvegarde.'); }
        } catch (e) { showDashboardNotice(e.message); }
        finally {
            ordoSave.disabled = false;
            ordoSave.innerHTML = '<i class="bi bi-check-lg me-1"></i>Sauvegarder';
        }
    });

    await reloadPatientFilesList(patientId, patientName);
}

async function reloadPatientFilesList(patientId, patientName) {
    const panel = document.getElementById('patient-files-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="text-center text-muted py-3"><div class="spinner-border spinner-border-sm me-2"></div>Chargement...</div>';
    try {
        const res   = await apiFetch('/patients/' + patientId + '/medical-files', { method: 'GET' });
        const files = res && res.ok ? await res.json().catch(() => []) : [];
        if (!files.length) {
            panel.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-folder-x fs-2 d-block mb-2"></i>Aucun fichier médical.</div>';
            return;
        }
        const listEl = document.createElement('div');
        listEl.className = 'list-group';
        files.forEach((f) => {
            const name = f.originalFileName || f.fileName || f.name || 'Document ' + f.id;
            const date = f.createdAt ? new Date(f.createdAt).toLocaleDateString('fr-FR') : '';
            const cat  = f.category || '';
            const badge = cat === 'PRESCRIPTION' ? '<span class="badge bg-success ms-2">Ordonnance</span>'
                        : cat === 'REPORT'       ? '<span class="badge bg-info ms-2">Rapport</span>'
                        : cat === 'IMAGING'      ? '<span class="badge bg-warning text-dark ms-2">Imagerie</span>' : '';
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center gap-2';
            item.innerHTML = '<div class="overflow-hidden"><i class="bi bi-file-earmark-medical me-2 text-primary"></i>' +
                '<span class="fw-semibold">' + name + '</span>' + badge +
                (date ? '<small class="text-muted ms-2">' + date + '</small>' : '') + '</div>' +
                '<div class="d-flex gap-1 flex-shrink-0">' +
                '<button class="btn btn-sm btn-outline-primary view-btn"><i class="bi bi-eye me-1"></i>Voir</button>' +
                '<button class="btn btn-sm btn-outline-danger del-btn"><i class="bi bi-trash3"></i></button>' +
                '</div>';
            item.querySelector('.view-btn').addEventListener('click', () => loadPatientFileInViewer(patientId, f.id, name));
            item.querySelector('.del-btn').addEventListener('click', async () => {
                if (!confirm(`Supprimer "${name}" ?`)) return;
                try {
                    const r = await apiFetch('/patients/' + patientId + '/medical-files/' + f.id, { method: 'DELETE' });
                    if (r && r.ok) { showDashboardNotice('Fichier supprimé.'); await reloadPatientFilesList(patientId, patientName); }
                    else showDashboardNotice('Erreur lors de la suppression.');
                } catch (e) { showDashboardNotice(e.message); }
            });
            listEl.appendChild(item);
        });
        panel.innerHTML = '';
        panel.appendChild(listEl);
    } catch (e) {
        panel.innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
}

async function loadPatientFileInViewer(patientId, fileId, fileName) {
    showDashboardNotice('Ouverture du document…');
    const res = await apiFetch('/patients/' + patientId + '/medical-files/' + fileId + '/download', { method: 'GET' });
    if (!res || !res.ok) { showDashboardNotice('Impossible de charger le document.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

async function showDoctorAppointments() {
    const area = document.querySelector('.file-viewer-area');
    if (!area) return;
    currentViewedPatient = null;

    area.innerHTML = `
        <div class="panel-heading d-flex align-items-center gap-2">
            <i class="bi bi-calendar2-check panel-heading-icon"></i>
            <h4 class="panel-heading-title mb-0">Mes Rendez-vous</h4>
        </div>
        <div id="dr-appt-calendar" class="mb-3"></div>
        <div id="dr-appt-list"><div class="text-center text-muted py-3"><div class="spinner-border spinner-border-sm me-2"></div>Chargement…</div></div>`;

    const user = getCurrentUser();
    let appts = [];
    try {
        const res = await apiFetch(`/appointments/doctor/${user.id}`, { method: 'GET' });
        appts = res && res.ok ? await res.json().catch(() => []) : [];
    } catch (_) {}

    const calEl  = document.getElementById('dr-appt-calendar');
    const listEl = document.getElementById('dr-appt-list');
    if (!calEl || !listEl) return;

    // ── Mini calendar ─────────────────────────────────────
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const confirmedDays = new Set(
        appts.filter(a => a.status === 'CONFIRMED')
             .map(a => new Date(a.scheduledAt).getDate() + '-' + new Date(a.scheduledAt).getMonth())
    );
    const pendingDays = new Set(
        appts.filter(a => a.status === 'PENDING')
             .map(a => new Date(a.scheduledAt).getDate() + '-' + new Date(a.scheduledAt).getMonth())
    );
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    let calHtml = `<div class="dr-cal-wrap"><div class="dr-cal-header">${monthNames[month]} ${year}</div>
        <div class="dr-cal-grid">
        <div class="dr-cal-day-label">Dim</div><div class="dr-cal-day-label">Lun</div><div class="dr-cal-day-label">Mar</div>
        <div class="dr-cal-day-label">Mer</div><div class="dr-cal-day-label">Jeu</div><div class="dr-cal-day-label">Ven</div>
        <div class="dr-cal-day-label">Sam</div>`;
    for (let i = 0; i < firstDay; i++) calHtml += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const key = d + '-' + month;
        const isToday = d === now.getDate();
        const dot = confirmedDays.has(key) ? 'confirmed' : pendingDays.has(key) ? 'pending' : '';
        calHtml += `<div class="dr-cal-day${isToday ? ' today' : ''}${dot ? ' has-appt' : ''}" data-day="${d}">
            ${d}${dot ? `<span class="dr-cal-dot ${dot}"></span>` : ''}</div>`;
    }
    calHtml += '</div></div>';
    calEl.innerHTML = calHtml;

    // Click a calendar day → scroll list to that day
    calEl.querySelectorAll('.dr-cal-day').forEach(cell => {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
            const day = parseInt(cell.dataset.day);
            const target = listEl.querySelector(`[data-appt-day="${day}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // ── Appointment list ──────────────────────────────────
    if (!appts.length) {
        listEl.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-calendar-x fs-2 d-block mb-2"></i>Aucun rendez-vous pour le moment.</div>';
        return;
    }

    appts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const grouped = {};
    appts.forEach(a => {
        const dt = new Date(a.scheduledAt);
        const key = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (!grouped[key]) grouped[key] = { day: dt.getDate(), list: [] };
        grouped[key].list.push(a);
    });

    let html = '';
    for (const [label, group] of Object.entries(grouped)) {
        html += `<div class="dr-appt-day-header" data-appt-day="${group.day}">${label}</div>`;
        group.list.forEach(a => {
            const time = new Date(a.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const sc = a.status === 'CONFIRMED' ? 'success' : a.status === 'CANCELLED' ? 'danger' : 'warning';
            const sl = a.status === 'CONFIRMED' ? 'Confirmé' : a.status === 'CANCELLED' ? 'Annulé' : 'En attente';
            const actions = a.status === 'PENDING' ? `
                <button class="btn btn-xs btn-success me-1 confirm-btn" data-id="${a.id}"><i class="bi bi-check2 me-1"></i>Confirmer</button>
                <button class="btn btn-xs btn-outline-danger cancel-btn" data-id="${a.id}"><i class="bi bi-x me-1"></i>Annuler</button>` : '';
            html += `<div class="dr-appt-item" data-appt-id="${a.id}">
                <div class="d-flex align-items-center gap-2">
                    <span class="dr-appt-time">${time}</span>
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${a.patientName || '—'}</div>
                        ${a.reason ? `<div class="small text-muted">${a.reason}</div>` : ''}
                    </div>
                    <span class="badge bg-${sc}">${sl}</span>
                </div>
                ${actions ? `<div class="mt-2">${actions}</div>` : ''}
            </div>`;
        });
    }
    listEl.innerHTML = html;

    // Wire confirm/cancel buttons
    listEl.querySelectorAll('.confirm-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            btn.disabled = true;
            try {
                const r = await apiFetch(`/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'CONFIRMED' }) });
                if (r && r.ok) { showDashboardNotice('Rendez-vous confirmé.'); showDoctorAppointments(); }
                else showDashboardNotice('Erreur.');
            } catch (e) { showDashboardNotice(e.message); }
        });
    });
    listEl.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            btn.disabled = true;
            try {
                const r = await apiFetch(`/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'CANCELLED' }) });
                if (r && r.ok) { showDashboardNotice('Rendez-vous annulé.'); showDoctorAppointments(); }
                else showDashboardNotice('Erreur.');
            } catch (e) { showDashboardNotice(e.message); }
        });
    });
}
window.showDoctorAppointments = showDoctorAppointments;

function restoreAppointmentsPanel() {
    const user = getCurrentUser();
    if (user && (user.role || '').toUpperCase() === 'DOCTOR') {
        showDoctorAppointments();
    } else {
        const area = document.querySelector('.file-viewer-area');
        if (area) area.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-calendar2-check fs-2 d-block mb-2"></i>Sélectionnez un patient pour voir ses fichiers.</div>';
    }
}

window.showPatientFilesInPanel = showPatientFilesInPanel;
window.loadPatientFileInViewer = loadPatientFileInViewer;
window.restoreAppointmentsPanel = restoreAppointmentsPanel;

// ── Doctor Agenda (week view) ─────────────────────────────────────────────────

function getWeekMonday(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function dateToStr(d) {
    return d.toISOString().split('T')[0];
}

async function showDoctorAgenda(doctorId, weekStart) {
    const noDoc   = document.getElementById('agenda-no-doctor');
    const view    = document.getElementById('agenda-view');
    const grid    = document.getElementById('agenda-week-grid');
    const label   = document.getElementById('agenda-week-label');
    if (!view || !grid) return;

    _agendaDoctorId = doctorId;

    if (!weekStart) weekStart = getWeekMonday(new Date());
    _agendaWeekStart = weekStart;

    if (noDoc) noDoc.classList.add('d-none');
    view.classList.remove('d-none');

    // Week label
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);
    if (label) {
        label.textContent =
            weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) +
            ' – ' +
            weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // Nav buttons
    const prevBtn = document.getElementById('agenda-prev-btn');
    const nextBtn = document.getElementById('agenda-next-btn');
    if (prevBtn) prevBtn.onclick = () => {
        const w = new Date(_agendaWeekStart);
        w.setDate(w.getDate() - 7);
        showDoctorAgenda(_agendaDoctorId, w);
    };
    if (nextBtn) nextBtn.onclick = () => {
        const w = new Date(_agendaWeekStart);
        w.setDate(w.getDate() + 7);
        showDoctorAgenda(_agendaDoctorId, w);
    };

    // Build 5 days (Mon–Fri)
    const days = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        days.push(d);
    }

    // Render skeleton
    grid.innerHTML = days.map((d, i) => `
        <div class="agenda-day-col" id="agenda-day-${i}">
            <div class="agenda-day-header">
                ${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
            </div>
            <div class="agenda-day-slots" id="agenda-slots-${i}">
                <span class="avail-cal-loading"><span class="spinner-border spinner-border-sm"></span></span>
            </div>
        </div>
    `).join('');

    // Fetch all 5 days in parallel
    // Fetch full appointment list (for patient names) + unavailable slots per day — all in parallel
    let weekAppts = [];
    try {
        const apptRes = await apiFetch(`/appointments/doctor/${doctorId}`, { method: 'GET' });
        if (apptRes && apptRes.ok) weekAppts = await apptRes.json().catch(() => []);
    } catch (_) {}

    const unavailablePerDay = await Promise.all(days.map(async (d) => {
        try {
            const res = await apiFetch(`/appointments/doctor/${doctorId}/slots?date=${dateToStr(d)}`, { method: 'GET' });
            if (res && res.ok) return await res.json().catch(() => []);
        } catch (_) {}
        return [];
    }));

    // Render each day
    const today0 = new Date(new Date().setHours(0, 0, 0, 0));
    days.forEach((d, i) => {
        const ds = dateToStr(d);
        const unavailable = Array.isArray(unavailablePerDay[i]) ? unavailablePerDay[i] : [];
        // Appointments for this specific day (not cancelled)
        const dayAppts = weekAppts.filter(a =>
            a.scheduledAt && a.scheduledAt.startsWith(ds) && a.status !== 'CANCELLED'
        );
        const slotsEl = document.getElementById(`agenda-slots-${i}`);
        if (!slotsEl) return;

        const isPast = d < today0;
        slotsEl.innerHTML = '';

        BOOKING_SLOTS.forEach((slot) => {
            // Check if a real appointment exists at this time slot
            const appt = dayAppts.find(a => a.scheduledAt && a.scheduledAt.substring(11, 16) === slot);
            const isBooked = !!appt;
            const isUnavailable = !isBooked && (unavailable.includes(slot) || isPast);

            const btn = document.createElement('button');
            btn.type = 'button';

            if (isBooked) {
                btn.className = 'avail-slot booked';
                const firstName = (appt.patientName || 'Patient').split(' ')[0];
                const statusLabel = appt.status === 'CONFIRMED' ? '✓' : '?';
                btn.innerHTML = `<span class="slot-time">${slot}</span><span class="slot-patient">${firstName} ${statusLabel}</span>`;
                btn.title = `${appt.patientName} — ${appt.reason || ''} (${appt.status})`;
            } else if (isUnavailable) {
                btn.className = 'avail-slot taken';
                btn.textContent = slot;
            } else {
                btn.className = 'avail-slot free';
                btn.textContent = slot;
                btn.addEventListener('click', () => {
                    openBookingModal(_agendaDoctorId, ds).then(() => {
                        setTimeout(() => {
                            const target = document.querySelector(`.booking-slot-btn[data-time="${slot}"]`);
                            if (target) target.click();
                        }, 100);
                    });
                });
            }
            slotsEl.appendChild(btn);
        });
    });
}

function handleAction(action) {
    const summaryView = document.getElementById('doctor-summary-view');
    const chatView = document.getElementById('chat-view');

    if (action === 'BackToSummary') {
        if (chatView) chatView.classList.add('d-none');
        currentChatPartnerId = null;
        if (!summaryView || summaryView.style.display === 'none') {
            if (currentViewedPatient) {
                showPatientFilesInPanel(currentViewedPatient.id, currentViewedPatient.name);
            } else {
                showDoctorAppointments();
            }
        } else {
            summaryView.classList.remove('d-none');
        }
        return;
    }

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

    if (action === 'BookAppointment') {
        openBookingModal(currentDoctorId);
        return;
    }

    if (action === 'Consultation Vidéo') {
        showDashboardNotice('La consultation vidéo sera disponible prochainement.');
    }
}

window.handleAction = handleAction;

// ── Appointment booking ─────────────────────────────────────────

const BOOKING_SLOTS = [
    '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
    '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'
];

async function openBookingModal(doctorId, initialDate) {
    const doctor = doctorsCache.find((x) => String(x.id) === String(doctorId));
    if (!doctor) return;

    const modalEl = document.getElementById('bookingModal');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    const nameEl = document.getElementById('booking-doctor-name');
    if (nameEl) nameEl.textContent = doctorDisplayName(doctor);

    const dateInput = document.getElementById('booking-date');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    // If it's past 17:30, all today's slots are gone — default to tomorrow
    const allTodaySlotsGone = (now.getHours() * 60 + now.getMinutes()) >= 17 * 60 + 30;
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const defaultDate = allTodaySlotsGone ? tomorrowStr : today;
    // Use the date passed from the agenda/calendar click; fall back to computed default
    const startDate = (initialDate && initialDate >= today) ? initialDate : defaultDate;
    if (dateInput) { dateInput.min = today; dateInput.value = startDate; }

    const reasonEl = document.getElementById('booking-reason');
    if (reasonEl) reasonEl.value = '';

    const msgEl = document.getElementById('booking-message');
    if (msgEl) { msgEl.className = 'alert d-none'; msgEl.textContent = ''; }

    await loadBookingSlots(doctorId, startDate);

    if (dateInput) {
        dateInput.onchange = () => loadBookingSlots(doctorId, dateInput.value);
    }

    const submitBtn = document.getElementById('booking-submit-btn');
    if (submitBtn) {
        submitBtn.onclick = () => submitBooking(doctorId);
    }

    modal.show();
}

async function loadBookingSlots(doctorId, dateStr) {
    const container = document.getElementById('booking-time-slots');
    if (!container) return;
    container.innerHTML = '<span class="text-muted small">Chargement…</span>';

    let bookedSlots = [];
    try {
        const res = await apiFetch(`/appointments/doctor/${doctorId}/slots?date=${dateStr}`, { method: 'GET' });
        if (res && res.ok) {
            const raw = await res.json().catch(() => []);
            bookedSlots = Array.isArray(raw) ? raw : [];
        }
    } catch (_) { /* ignore */ }

    // Grey out past slots when the selected date is today
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    container.innerHTML = '';
    BOOKING_SLOTS.forEach((slot) => {
        const [h, m] = slot.split(':').map(Number);
        const slotMinutes = h * 60 + m;
        const isPast = (dateStr === todayStr) && (slotMinutes <= nowMinutes);
        const taken = bookedSlots.includes(slot) || isPast;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = taken
            ? 'btn btn-sm btn-secondary disabled'
            : 'btn btn-sm btn-outline-primary booking-slot-btn';
        btn.textContent = slot;
        btn.dataset.time = slot;
        if (!taken) {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.booking-slot-btn').forEach((b) => {
                    b.classList.remove('active', 'btn-primary');
                    b.classList.add('btn-outline-primary');
                });
                btn.classList.remove('btn-outline-primary');
                btn.classList.add('active', 'btn-primary');
            });
        }
        container.appendChild(btn);
    });
}

async function submitBooking(doctorId) {
    const dateInput = document.getElementById('booking-date');
    const activeSlot = document.querySelector('.booking-slot-btn.active');
    const reasonEl = document.getElementById('booking-reason');
    const msgEl = document.getElementById('booking-message');
    const submitBtn = document.getElementById('booking-submit-btn');

    const showMsg = (cls, txt) => {
        if (!msgEl) return;
        msgEl.className = `alert ${cls}`;
        msgEl.textContent = txt;
    };

    if (!dateInput?.value) { showMsg('alert-warning', 'Veuillez choisir une date.'); return; }
    if (!activeSlot) { showMsg('alert-warning', 'Veuillez choisir une heure.'); return; }

    const scheduledAt = `${dateInput.value}T${activeSlot.dataset.time}:00`;
    const user = getCurrentUser();

    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Confirmation…'; }

    try {
        const res = await apiFetch('/appointments', {
            method: 'POST',
            body: JSON.stringify({
                patientId: user.id,
                doctorId: Number(doctorId),
                scheduledAt,
                reason: reasonEl?.value.trim() || 'Consultation générale'
            })
        });
        const data = await res?.json().catch(() => ({}));
        if (res && res.ok) {
            showMsg('alert-success', 'Rendez-vous confirmé ! Le médecin sera notifié.');
            setTimeout(() => bootstrap.Modal.getInstance(document.getElementById('bookingModal'))?.hide(), 2000);
        } else {
            throw new Error(data.message || 'Impossible de confirmer le rendez-vous.');
        }
    } catch (e) {
        showMsg('alert-danger', e.message);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-calendar-check me-1"></i>Confirmer'; }
    }
}

function restorePatientPanels(activateTab) {
    const tabBar    = document.getElementById('patient-tab-bar');
    const files     = document.getElementById('ptab-files');
    const nearby    = document.getElementById('ptab-nearby');
    const mapPanel  = document.getElementById('ptab-map');
    const apptPanel = document.getElementById('appt-panel-container');

    if (apptPanel) apptPanel.style.display = 'none';
    if (tabBar) tabBar.style.display = '';

    const tab = activateTab || 'files';
    if (files)    files.classList.toggle('d-none',  tab !== 'files');
    if (nearby)   nearby.classList.toggle('d-none', tab !== 'nearby');
    if (mapPanel) mapPanel.classList.toggle('d-none', tab !== 'map');

    // If switching to agenda tab and a doctor is already selected, load it
    if (tab === 'nearby' && _agendaDoctorId) {
        showDoctorAgenda(_agendaDoctorId, getWeekMonday(new Date()));
    }

    // If switching to map tab, trigger map initialization
    if (tab === 'map') {
        initNearbyMap();
    }

    // Sync tab button active state
    document.querySelectorAll('.ptab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.ptab === tab);
    });
}
window.restorePatientPanels = restorePatientPanels;

// ── Nearby Medical Services Map ─────────────────────────────────
let _nearbyMap = null;
let _nearbyMarkersLayer = null;

const NEARBY_COLORS = {
    'Hôpital':        '#e63946',
    'Clinique':       '#0d6efd',
    'Pharmacie':      '#28a745',
    'Cabinet médical':'#0aa896',
    'Dentiste':       '#fd7e14'
};

function nearbyMarkerIcon(type) {
    const color = NEARBY_COLORS[type] || '#6c757d';
    return L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
}

async function initNearbyMap() {
    const container = document.getElementById('nearby-map-container');
    const statusEl  = document.getElementById('map-status');
    if (!container) return;

    // Tab re-opened: map already exists, nothing to do
    if (_nearbyMap) { return; }

    if (!navigator.geolocation) {
        if (statusEl) statusEl.textContent = 'La géolocalisation n\'est pas supportée par ce navigateur.';
        return;
    }

    // ── Step 1: Create the map SYNCHRONOUSLY while the container is visible ──
    // Default center = Tunisia. We move the view once geolocation resolves.
    const DEFAULT_LAT = 36.8065, DEFAULT_LNG = 10.1815;
    _nearbyMap = L.map('nearby-map-container', { zoomControl: true }).setView([DEFAULT_LAT, DEFAULT_LNG], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(_nearbyMap);

    if (statusEl) statusEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Localisation en cours…';

    // ── Step 2: Geolocation — just pan/zoom, no map rebuild ──
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            _nearbyMap.setView([lat, lng], 14);

            // User position marker
            L.marker([lat, lng], {
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:16px;height:16px;border-radius:50%;background:#0d6efd;border:3px solid #fff;box-shadow:0 0 0 3px rgba(13,110,253,.4)"></div>',
                    iconSize: [16, 16], iconAnchor: [8, 8]
                })
            }).addTo(_nearbyMap).bindPopup('<b>Vous êtes ici</b>').openPopup();

            if (statusEl) statusEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Chargement des services médicaux…';

            try {
                const res = await apiFetch(`/nearby-medical?lat=${lat}&lng=${lng}&radius=3000`, { method: 'GET' });
                const places = (res && res.ok) ? await res.json().catch(() => []) : [];

                _nearbyMarkersLayer = L.layerGroup().addTo(_nearbyMap);

                places.forEach((p) => {
                    const icon = nearbyMarkerIcon(p.type);
                    const dist = p.distance >= 1000
                        ? (p.distance / 1000).toFixed(1) + ' km'
                        : Math.round(p.distance) + ' m';
                    const addr = [p.street, p.city].filter(Boolean).join(', ');
                    L.marker([p.lat, p.lon], { icon })
                        .addTo(_nearbyMarkersLayer)
                        .bindPopup(
                            `<div style="min-width:160px">
                                <strong>${p.name}</strong><br>
                                <span style="color:#6c757d;font-size:.85em">${p.type}</span><br>
                                ${addr ? `<span style="font-size:.82em">${addr}</span><br>` : ''}
                                <span style="font-size:.82em;color:#0aa896">${dist}</span>
                            </div>`
                        );
                });

                if (statusEl) {
                    statusEl.innerHTML = places.length > 0
                        ? `<strong>${places.length}</strong> services trouvés dans un rayon de 3 km.`
                        : 'Aucun service médical trouvé dans un rayon de 3 km.';
                }

                // Render sorted facilities list below the map
                const listWrapper = document.getElementById('nearby-facilities-list');
                const listRows    = document.getElementById('nearby-facilities-rows');
                if (listWrapper && listRows && places.length > 0) {
                    const sorted = [...places].sort((a, b) => a.distance - b.distance);
                    listRows.innerHTML = sorted.map((p) => {
                        const color = NEARBY_COLORS[p.type] || '#6c757d';
                        const dist  = p.distance >= 1000
                            ? (p.distance / 1000).toFixed(1) + ' km'
                            : Math.round(p.distance) + ' m';
                        const addr  = [p.street, p.city].filter(Boolean).join(', ');
                        return `<div class="nearby-facility-row">
                            <span class="map-dot flex-shrink-0" style="background:${color}"></span>
                            <div class="nearby-facility-info">
                                <span class="nearby-facility-name">${p.name}</span>
                                <span class="nearby-facility-type">${p.type}${addr ? ' · ' + addr : ''}</span>
                            </div>
                            <span class="nearby-facility-dist">${dist}</span>
                        </div>`;
                    }).join('');
                    listWrapper.style.display = '';
                }
            } catch (e) {
                if (statusEl) statusEl.textContent = 'Impossible de charger les services médicaux. Vérifiez le backend.';
            }
        },
        () => {
            if (statusEl) statusEl.innerHTML =
                '<span class="text-danger">Géolocalisation refusée. Activez la localisation dans votre navigateur.</span>';
        },
        { timeout: 10000 }
    );
}

window.initNearbyMap = initNearbyMap;

async function showMyAppointments() {
    const area = document.querySelector('.file-viewer-area');
    if (!area) return;
    const user = getCurrentUser();

    // Hide normal panels (don't destroy them)
    const tabBar   = document.getElementById('patient-tab-bar');
    const files    = document.getElementById('ptab-files');
    const nearby   = document.getElementById('ptab-nearby');
    const mapPanel = document.getElementById('ptab-map');
    if (tabBar)   tabBar.style.display = 'none';
    if (files)    files.classList.add('d-none');
    if (nearby)   nearby.classList.add('d-none');
    if (mapPanel) mapPanel.classList.add('d-none');

    // Create or reuse appt panel
    let apptPanel = document.getElementById('appt-panel-container');
    if (!apptPanel) {
        apptPanel = document.createElement('div');
        apptPanel.id = 'appt-panel-container';
        area.appendChild(apptPanel);
    }
    apptPanel.style.display = '';
    apptPanel.innerHTML = `
        <div class="panel-heading d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="restorePatientPanels('files')" title="Retour">
                <i class="bi bi-arrow-left"></i>
            </button>
            <i class="bi bi-calendar2-check panel-heading-icon"></i>
            <h4 class="panel-heading-title mb-0">Mes Rendez-vous</h4>
        </div>
        <div id="appt-list-container">
            <div class="text-center text-muted py-4">
                <div class="spinner-border spinner-border-sm me-2"></div>Chargement…
            </div>
        </div>`;

    try {
        const res = await apiFetch(`/appointments/patient/${user.id}`, { method: 'GET' });
        const appts = res && res.ok ? await res.json().catch(() => []) : [];
        const container = document.getElementById('appt-list-container');
        if (!container) return;

        if (!appts.length) {
            container.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-calendar-x fs-2 d-block mb-2"></i>Aucun rendez-vous pour le moment.</div>';
            return;
        }

        const listEl = document.createElement('div');
        listEl.className = 'list-group';
        appts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).forEach((appt) => {
            const dt = new Date(appt.scheduledAt);
            const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
            const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const statusColor = appt.status === 'CONFIRMED' ? 'success' : appt.status === 'CANCELLED' ? 'danger' : 'warning';
            const item = document.createElement('div');
            item.className = 'list-group-item';
            item.innerHTML = `<div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                    <div class="fw-bold"><i class="bi bi-person-badge me-1 text-primary"></i>${appt.doctorName || ''}</div>
                    <div class="small text-muted mt-1"><i class="bi bi-calendar3 me-1"></i>${dateStr} à ${timeStr}</div>
                    ${appt.reason ? `<div class="small text-muted"><i class="bi bi-chat-left-text me-1"></i>${appt.reason}</div>` : ''}
                </div>
                <span class="badge bg-${statusColor} text-nowrap">${appt.status || 'EN ATTENTE'}</span>
            </div>`;
            listEl.appendChild(item);
        });
        container.innerHTML = '';
        container.appendChild(listEl);
    } catch (e) {
        const container = document.getElementById('appt-list-container');
        if (container) container.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
}

// ── Doctor mode: load patients from appointments ────────────────

async function loadDoctorPatients() {
    const container = document.getElementById('doctor-list-container');
    if (!container) return;

    const titleEl = document.getElementById('sidebar-section-title');
    if (titleEl) titleEl.textContent = 'Vos Patients';

    // Hide patient-only panels and sidebar cards
    ['patient-tab-bar', 'ptab-files', 'ptab-nearby'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const reportsNavCard = document.querySelector('.reports-card');
    if (reportsNavCard) reportsNavCard.style.display = 'none';

    // Hide doctor right-panel summary (makes no sense for a doctor viewing their own dashboard)
    const summaryView = document.getElementById('doctor-summary-view');
    if (summaryView) summaryView.style.display = 'none';

    showDoctorAppointments();

    const placeholder = document.getElementById('doctor-list-placeholder');
    if (placeholder) placeholder.remove();

    const user = getCurrentUser();
    let appts = [];
    try {
        const res = await apiFetch(`/appointments/doctor/${user.id}`, { method: 'GET' });
        if (res && res.ok) appts = await res.json().catch(() => []);
    } catch (_) { /* ignore */ }

    // Group by patient
    const patientsMap = new Map();
    appts.forEach((a) => {
        const pid = a.patientId;
        if (!patientsMap.has(pid)) {
            patientsMap.set(pid, {
                id: pid,
                name: (a.patientName || '').trim() || `Patient #${pid}`,
                avatarUrl: a.patientAvatarUrl || null,
                count: 0
            });
        }
        patientsMap.get(pid).count++;
    });

    const reportsCard = container.querySelector('[data-action="reports"]');
    container.querySelectorAll('.doctor-nav-card[data-patient-id]').forEach((el) => el.remove());

    if (!patientsMap.size) {
        const empty = document.createElement('div');
        empty.className = 'text-muted text-center small py-3 px-2';
        empty.textContent = 'Aucun patient pour le moment.';
        reportsCard ? container.insertBefore(empty, reportsCard) : container.appendChild(empty);
        return;
    }

    patientsMap.forEach((patient) => {
        const card = document.createElement('div');
        card.className = 'doctor-nav-card';
        card.setAttribute('data-patient-id', String(patient.id));
        card.innerHTML = `
            <span class="doctor-nav-icon">${patient.avatarUrl
                ? `<img src="${patient.avatarUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">`
                : `<i class="bi bi-person-circle text-primary" style="font-size:1.5rem;"></i>`}</span>
            <div class="ms-3 overflow-hidden">
                <span class="d-block fw-bold text-truncate">${patient.name}</span>
                <small class="text-muted">${patient.count} rendez-vous</small>
            </div>`;
        card.addEventListener('click', () => {
            container.querySelectorAll('.doctor-nav-card[data-patient-id]').forEach((c) => c.classList.remove('active-doctor'));
            card.classList.add('active-doctor');
            showPatientFilesInPanel(patient.id, patient.name);
        });
        reportsCard ? container.insertBefore(card, reportsCard) : container.appendChild(card);
    });
}

window.openBookingModal = openBookingModal;
window.showMyAppointments = showMyAppointments;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.app-wrapper')) {
        return;
    }

    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem('tbibi_user'));
        } catch (error) {
            return null;
        }
    })();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentPatientId = user.id;

    const logout = document.getElementById('logout-link');
    if (logout) {
        logout.addEventListener('click', () => {
            clearSession();
        });
    }

    // Close PDF viewer button
    var closeViewerBtn = document.getElementById('close-viewer-btn');
    if (closeViewerBtn) {
        closeViewerBtn.addEventListener('click', function() {
            var box = document.getElementById('file-viewer-box');
            var iframe = document.getElementById('medical-file-iframe');
            var title = document.getElementById('current-file-title');
            if (box) box.style.display = 'none';
            if (iframe) iframe.src = 'about:blank';
            if (lastMedicalBlobUrl) { URL.revokeObjectURL(lastMedicalBlobUrl); lastMedicalBlobUrl = null; }
            if (title) title.textContent = '—';
        });
    }

    // "Rapports & Bilans" sidebar card — scroll to file history section
    var reportsCard = document.querySelector('[data-action="reports"]');
    if (reportsCard) {
        reportsCard.addEventListener('click', function() {
            var fileSection = document.querySelector('.file-history-section');
            if (fileSection) {
                fileSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                fileSection.style.transition = 'box-shadow 0.3s';
                fileSection.style.boxShadow = '0 0 0 3px #0d6efd55';
                setTimeout(function() { fileSection.style.boxShadow = ''; }, 1500);
            }
        });
    }

    var zoomSlider = document.getElementById('pdf-zoom-slider');
    var zoomLabel  = document.getElementById('pdf-zoom-label');
    if (zoomSlider) {
        zoomSlider.addEventListener('input', function() {
            var pct = zoomSlider.value + '%';
            document.getElementById('medical-file-iframe').style.zoom = zoomSlider.value / 100;
            if (zoomLabel) zoomLabel.textContent = pct;
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

            const files = [...uploadInput.files];

            try {
                const patientId = resolveCurrentPatientId();
                if (!patientId) {
                    throw new Error('Impossible de déterminer votre identifiant patient.');
                }

                for (const file of files) {
                    const formData = new FormData();
                    formData.append('file', file);

                    const response = await apiFetch(`/patients/${patientId}/medical-files`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response) {
                        return;
                    }

                    if (!response.ok) {
                        const payload = await response.json().catch(() => ({}));
                        throw new Error(payload.message || 'Upload impossible.');
                    }
                }

                showDashboardNotice('Fichier(s) envoyé(s) avec succès.');
                await loadMedicalFiles();
            } catch (error) {
                console.error(error);
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
    const chatSendBtn    = document.getElementById('chat-send-btn');
    const chatImageBtn   = document.getElementById('chat-image-btn');
    const chatImageInput = document.getElementById('chat-image-input');

    const partnerId = () => currentChatPartnerId || currentDoctorId;

    if (chatSendBtn && chatInputField) {
        const send = async () => {
            const messageText = chatInputField.value.trim();
            if (!messageText || !partnerId()) return;
            try {
                await sendChatMessage(partnerId(), messageText);
                chatInputField.value = '';
            } catch (error) {
                showDashboardNotice(error.message || 'Erreur lors de l\'envoi du message.');
            }
        };
        chatSendBtn.addEventListener('click', send);
        chatInputField.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') { event.preventDefault(); send(); }
        });
    }

    // Chat image send
    if (chatImageBtn && chatImageInput) {
        chatImageBtn.addEventListener('click', () => chatImageInput.click());
        chatImageInput.addEventListener('change', async () => {
            const file = chatImageInput.files[0];
            if (!file || !partnerId()) return;
            chatImageBtn.disabled = true;
            try {
                const form = new FormData();
                form.append('image', file);
                const res = await apiFetch('/uploads/chat-image', { method: 'POST', body: form });
                if (!res || !res.ok) throw new Error('Upload image échoué.');
                const data = await res.json();
                await sendChatMessage(partnerId(), '', data.imageUrl);
            } catch (e) {
                showDashboardNotice(e.message || 'Erreur envoi image.');
            } finally {
                chatImageBtn.disabled = false;
                chatImageInput.value = '';
            }
        });
    }

    // "Book appointment" button in doctor profile panel
    const bookApptBtn = document.getElementById('book-appt-btn');
    if (bookApptBtn) {
        bookApptBtn.addEventListener('click', () => handleAction('BookAppointment'));
    }

    // "Me localiser" button in the map tab — re-runs geolocation and reloads markers
    const mapLocateBtn = document.getElementById('map-locate-btn');
    if (mapLocateBtn) {
        mapLocateBtn.addEventListener('click', () => {
            // Destroy existing map so initNearbyMap re-creates it with fresh location
            if (_nearbyMap) { _nearbyMap.remove(); _nearbyMap = null; _nearbyMarkersLayer = null; }
            initNearbyMap();
        });
    }

    // "Mes Rendez-vous" sidebar shortcut — doctor sees their agenda, patient sees their appointments
    const myApptsCard = document.querySelector('[data-action="appointments"]');
    if (myApptsCard) {
        myApptsCard.addEventListener('click', () => {
            const r = (getCurrentUser()?.role || '').toUpperCase();
            if (r === 'DOCTOR') showDoctorAppointments();
            else showMyAppointments();
        });
    }

    // "Mes Fichiers Médicaux" sidebar shortcut → restore to files tab
    const myFilesCard = document.querySelector('[data-action="reports"]');
    if (myFilesCard) {
        myFilesCard.addEventListener('click', () => restorePatientPanels('files'));
    }

    // Tab bar: Dossier Médical / Services Proches
    document.querySelectorAll('.ptab').forEach((btn) => {
        btn.addEventListener('click', () => restorePatientPanels(btn.dataset.ptab));
    });

    // Role-based initialisation
    const role = (user.role || '').toUpperCase();
    if (role === 'DOCTOR') {
        loadDoctorPatients().catch((err) => {
            showDashboardNotice(err.message || 'Erreur de chargement.');
        });
    } else {
        Promise.all([loadDoctors(), loadMedicalFiles()]).catch((error) => {
            console.error(error);
            showDashboardNotice(error.message || 'Impossible de charger vos données.');
            // Unblock any stuck "Chargement…" UI so the user sees the error state.
            const placeholder = document.getElementById('doctor-list-placeholder');
            if (placeholder) {
                placeholder.innerHTML = '<div class="text-danger small text-center py-2">Erreur de chargement des médecins. Vérifiez le backend.</div>';
            }
            const title = document.getElementById('doctor-title');
            if (title && /Chargement/i.test(title.textContent)) {
                title.textContent = 'Indisponible';
            }
        });
    }
});
