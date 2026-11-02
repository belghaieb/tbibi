// TBIBI — Forgot password page (Step 1: request reset email)
// Calls POST /api/auth/forgot-password with { email }

const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';

const forgotForm      = document.getElementById('forgot-form');
const emailInput      = document.getElementById('reset-email');
const submitBtn       = document.getElementById('forgot-submit-btn');
const alertBox        = document.getElementById('email-alert');
const stepEmail       = document.getElementById('step-email');
const stepSent        = document.getElementById('step-sent');
const sentDisplay     = document.getElementById('sent-email-display');
const resendBtn       = document.getElementById('resend-btn');

let lastEmail = '';

/* ── Helpers ──────────────────────────────────────── */
function showAlert(message, type = 'danger') {
    alertBox.className = `alert alert-${type}`;
    alertBox.innerHTML = `<i class="bi bi-${type === 'danger' ? 'exclamation-circle' : 'check-circle'}-fill me-2"></i>${message}`;
    alertBox.classList.remove('d-none');
}

function clearAlert() {
    alertBox.classList.add('d-none');
}

function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
        ? '<span class="spinner-border spinner-border-sm me-2"></span>Envoi en cours…'
        : '<i class="bi bi-envelope-arrow-up-fill me-2"></i>Envoyer le lien';
}

/* ── Submit handler ────────────────────────────────── */
async function requestReset(email) {
    setLoading(true);
    clearAlert();

    try {
        const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        // Always show the success screen — never reveal whether the email exists
        // (security best practice: avoid user enumeration)
        if (res.ok || res.status === 404) {
            lastEmail = email;
            sentDisplay.textContent = email;
            showStep('step-sent');
            return;
        }

        // Unexpected server error
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Une erreur est survenue. Réessayez.');
    } catch (err) {
        if (err.name === 'TypeError') {
            // Network / server unreachable
            showAlert('Impossible de contacter le serveur. Vérifiez votre connexion.');
        } else {
            showAlert(err.message);
        }
    } finally {
        setLoading(false);
    }
}

/* ── Form submit ───────────────────────────────────── */
forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = emailInput.value.trim();
    if (!email) {
        showAlert('Veuillez saisir votre adresse email.');
        emailInput.focus();
        return;
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert('Veuillez saisir une adresse email valide.');
        emailInput.focus();
        return;
    }

    await requestReset(email);
});

/* ── Resend button ─────────────────────────────────── */
resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Envoi…';

    await requestReset(lastEmail);

    // Re-show the sent screen with feedback (already shown, just re-render)
    sentDisplay.textContent = lastEmail;
    showStep('step-sent');

    // Cooldown: disable resend for 30 s to avoid spam
    let seconds = 30;
    const interval = setInterval(() => {
        resendBtn.textContent = `Renvoyer l'email (${seconds}s)`;
        seconds--;
        if (seconds < 0) {
            clearInterval(interval);
            resendBtn.disabled = false;
            resendBtn.textContent = "Renvoyer l'email";
        }
    }, 1000);
});
