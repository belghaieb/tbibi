const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';

let currentUser = getCurrentUser();

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('tbibi_user');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

if (!currentUser) {
    window.location.href = 'login.html';
}

let confirmPasswordInput = null;

function clearSession() {
    localStorage.clear();
}

async function apiFetch(path, options = {}) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
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

function showAlert(message, type = 'success') {
    let box = document.getElementById('account-alert');
    if (!box) {
        box = document.createElement('div');
        box.id = 'account-alert';
        box.className = `alert alert-${type}`;
        const main = document.querySelector('main.container');
        if (main) {
            main.insertBefore(box, main.firstChild);
        }
    }

    box.className = `alert alert-${type}`;
    box.textContent = message;
}

function updateSidebar(user, subscription) {
    document.getElementById('account-sidebar-name').textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    document.getElementById('account-sidebar-role').textContent = user.role || '—';
    document.getElementById('account-sidebar-email').textContent = user.email || '—';
    document.getElementById('account-sidebar-phone').textContent = user.phone || '—';

    const planCode = (subscription || user.subscriptionCode || user.subscriptionPlan || 'Aucune formule').toString().toUpperCase();
    const planLabel = planCode === 'BASIC' ? 'Essentiel' : planCode === 'PREMIUM' ? 'Premium' : planCode;
    document.getElementById('account-sidebar-plan').textContent = planLabel;
}

function updateProfileForm(user) {
    document.getElementById('profile-first-name').value = user.firstName || '';
    document.getElementById('profile-last-name').value = user.lastName || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-phone').value = user.phone || '';

    const isDoctor = String(user.role || '').toUpperCase() === 'DOCTOR';
    const specialtyRow = document.getElementById('doctor-extra-fields');
    const bioRow = document.getElementById('doctor-bio-row');

    if (isDoctor) {
        specialtyRow.classList.remove('d-none');
        bioRow.classList.remove('d-none');
        document.getElementById('profile-specialty').value = user.specialty || '';
        document.getElementById('profile-bio').value = user.bio || '';
    } else {
        specialtyRow.classList.add('d-none');
        bioRow.classList.add('d-none');
    }
}

function updateSubscription(subscriptionCode) {
    const summary = document.getElementById('subscription-summary');
    const perks = document.getElementById('subscription-perks');
    const planCode = (subscriptionCode || 'AUCUNE FORMULE').toString().toUpperCase();

    if (!subscriptionCode) {
        summary.textContent = 'Aucun abonnement actif.';
        perks.innerHTML = '';
        return;
    }

    const planLabel = planCode === 'BASIC' ? 'Essentiel' : planCode === 'PREMIUM' ? 'Premium' : planCode;
    const featureMap = {
        BASIC: ['Accès au tableau de bord', 'Dossier médical personnel', 'Recherche des services proches'],
        PREMIUM: ['Accès au tableau de bord', 'Dossier médical personnel', 'Recherche des services proches', 'Priorité sur les services premium']
    };

    summary.textContent = `Formule ${planLabel} active.`;
    const items = featureMap[planCode] || [];
    perks.innerHTML = items
        .map((item) => `<li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>${item}</li>`)
        .join('');
}

async function loadAccountData() {
    const userId = currentUser?.id;
    const userRes = await apiFetch(`/account/me?userId=${encodeURIComponent(userId)}`, { method: 'GET' });

    if (!userRes) {
        return;
    }

    const userPayload = await userRes.json().catch(() => ({}));

    if (!userRes.ok) {
        throw new Error(userPayload.message || 'Impossible de charger le profil.');
    }

    currentUser = {
        ...currentUser,
        ...userPayload,
        subscriptionCode: currentUser?.subscriptionCode || userPayload.subscriptionCode || null
    };
    localStorage.setItem('tbibi_user', JSON.stringify(currentUser));

    updateProfileForm(userPayload);
    updateSidebar(currentUser, currentUser?.subscriptionCode);
    updateSubscription(currentUser?.subscriptionCode);
}

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        return;
    }

    const avatarInput = document.getElementById('avatar-upload-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', async () => {
            if (!avatarInput.files.length) return;
            const fd = new FormData();
            fd.append('userId', currentUser?.id);
            fd.append('avatar', avatarInput.files[0]);
            try {
                const res = await apiFetch('/uploads/avatar', { method: 'POST', body: fd });
                if (!res) return;
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || 'Upload impossible.');
                if (data.avatarUrl) {
                    document.getElementById('account-avatar').src = data.avatarUrl;
                }
                showAlert('Photo de profil mise à jour.');
            } catch (err) {
                showAlert(err.message || 'Erreur lors de l\'upload.', 'danger');
            } finally {
                avatarInput.value = '';
            }
        });
    }

    const logout = document.getElementById('logout-link');
    if (logout) {
        logout.addEventListener('click', () => {
            clearSession();
            window.location.href = 'login.html';
        });
    }

    const newPasswordInput = document.getElementById('new-password');
    if (newPasswordInput && !document.getElementById('confirm-password')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-3';
        wrapper.innerHTML = `
            <label class="form-label" for="confirm-password">Confirmer le nouveau mot de passe</label>
            <input type="password" class="form-control" id="confirm-password" autocomplete="new-password">
        `;
        newPasswordInput.closest('.mb-3')?.after(wrapper);
    }

    confirmPasswordInput = document.getElementById('confirm-password');

    loadAccountData().catch((error) => {
        console.error(error);
        showAlert(error.message || 'Erreur de chargement du compte.', 'danger');
    });

    document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const payload = {
            firstName: document.getElementById('profile-first-name').value.trim(),
            lastName: document.getElementById('profile-last-name').value.trim(),
            phone: document.getElementById('profile-phone').value.trim(),
            specialty: document.getElementById('profile-specialty')?.value?.trim() || null,
            bio: document.getElementById('profile-bio')?.value?.trim() || null
        };

        try {
            const response = await apiFetch(`/account/me?userId=${encodeURIComponent(currentUser?.id)}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (!response) {
                return;
            }

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message || 'Impossible de mettre à jour le profil.');
            }

            currentUser = {
                ...currentUser,
                ...body,
                ...payload,
                subscriptionCode: currentUser?.subscriptionCode || body.subscriptionCode || null
            };
            localStorage.setItem('tbibi_user', JSON.stringify(currentUser));

            showAlert('Profil mis à jour avec succès.');
            await loadAccountData();
        } catch (error) {
            console.error(error);
            showAlert(error.message || 'Erreur lors de la mise à jour du profil.', 'danger');
        }
    });

    document.getElementById('save-password-btn').addEventListener('click', async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = confirmPasswordInput?.value || '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            showAlert('Veuillez saisir les deux mots de passe.', 'danger');
            return;
        }

        if (newPassword !== confirmPassword) {
            showAlert('Les mots de passe ne correspondent pas.', 'danger');
            return;
        }

        try {
            const response = await apiFetch(`/account/password?userId=${encodeURIComponent(currentUser?.id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (!response) {
                return;
            }

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message || 'Impossible de changer le mot de passe.');
            }

            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            if (confirmPasswordInput) {
                confirmPasswordInput.value = '';
            }
            showAlert('Mot de passe mis à jour avec succès.');
        } catch (error) {
            console.error(error);
            showAlert(error.message || 'Erreur lors du changement de mot de passe.', 'danger');
        }
    });
});
