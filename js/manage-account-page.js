const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8080/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';
const REFRESH_TOKEN_KEY = 'tbibi_refresh_token';

function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('tbibi_session');
    localStorage.removeItem('tbibi_user');
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
        throw new Error('Session expirée.');
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

    const planLabel = subscription?.planCode || user.subscriptionPlan || 'Aucune formule';
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

function updateSubscription(subscription) {
    const summary = document.getElementById('subscription-summary');
    const perks = document.getElementById('subscription-perks');

    if (!subscription) {
        summary.textContent = 'Aucun abonnement actif.';
        perks.innerHTML = '';
        return;
    }

    const status = subscription.status || 'INACTIVE';
    const renewal = subscription.renewalDate || subscription.nextBillingDate || '—';
    summary.textContent = `Formule ${subscription.planCode || '—'} — Statut: ${status} — Renouvellement: ${renewal}`;

    const items = subscription.features || [];
    perks.innerHTML = items
        .map((item) => `<li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>${item}</li>`)
        .join('');
}

async function loadAccountData() {
    const [userRes, subRes] = await Promise.all([
        apiFetch('/users/me', { method: 'GET' }),
        apiFetch('/subscriptions/me', { method: 'GET' })
    ]);

    const userPayload = await userRes.json().catch(() => ({}));
    const subPayload = await subRes.json().catch(() => ({}));

    if (!userRes.ok) {
        throw new Error(userPayload.message || 'Impossible de charger le profil.');
    }

    if (!subRes.ok && subRes.status !== 404) {
        throw new Error(subPayload.message || 'Impossible de charger l\'abonnement.');
    }

    updateProfileForm(userPayload);
    updateSidebar(userPayload, subRes.ok ? subPayload : null);
    updateSubscription(subRes.ok ? subPayload : null);
}

document.addEventListener('DOMContentLoaded', () => {
    const logout = document.getElementById('logout-link');
    if (logout) {
        logout.addEventListener('click', () => {
            clearSession();
        });
    }

    loadAccountData().catch((error) => {
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
            const response = await apiFetch('/users/me', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message || 'Impossible de mettre à jour le profil.');
            }

            showAlert('Profil mis à jour avec succès.');
            await loadAccountData();
        } catch (error) {
            showAlert(error.message || 'Erreur lors de la mise à jour du profil.', 'danger');
        }
    });

    document.getElementById('save-password-btn').addEventListener('click', async () => {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;

        if (!currentPassword || !newPassword) {
            showAlert('Veuillez saisir les deux mots de passe.', 'danger');
            return;
        }

        try {
            const response = await apiFetch('/users/me/password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message || 'Impossible de changer le mot de passe.');
            }

            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            showAlert('Mot de passe mis à jour avec succès.');
        } catch (error) {
            showAlert(error.message || 'Erreur lors du changement de mot de passe.', 'danger');
        }
    });
});
