// TBIBI — Reset password page (Step 2: set new password from email link)
// URL expected: reset-password.html?token=XXXXXXXX
//
// API calls:
//   GET  /api/auth/validate-reset-token?token=X   → 200 OK or 400/404
//   POST /api/auth/reset-password                 → { token, newPassword }

const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';

const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;

/* ── DOM refs ──────────────────────────────────────── */
const newPassInput    = document.getElementById('new-password');
const confirmInput    = document.getElementById('confirm-password');
const resetForm       = document.getElementById('reset-form');
const submitBtn       = document.getElementById('reset-submit-btn');
const formAlert       = document.getElementById('form-alert');
const matchError      = document.getElementById('match-error');
const strengthFill    = document.getElementById('strength-fill');
const strengthLabel   = document.getElementById('strength-label');

/* ── Step helpers ──────────────────────────────────── */
function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showAlert(message, type = 'danger') {
    formAlert.className = `alert alert-${type}`;
    formAlert.innerHTML = `<i class="bi bi-${type === 'danger' ? 'exclamation-circle' : 'check-circle'}-fill me-2"></i>${message}`;
    formAlert.classList.remove('d-none');
}

function clearAlert() {
    formAlert.classList.add('d-none');
}

function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
        ? '<span class="spinner-border spinner-border-sm me-2"></span>Enregistrement…'
        : '<i class="bi bi-lock-fill me-2"></i>Enregistrer le nouveau mot de passe';
}

/* ── Password strength meter ───────────────────────── */
function scorePassword(pw) {
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw))    score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0–5
}

function updateStrength(pw) {
    const score = scorePassword(pw);
    const levels = [
        { pct: 0,   color: '#e5e7eb', text: '' },
        { pct: 20,  color: '#ef4444', text: 'Très faible' },
        { pct: 40,  color: '#f97316', text: 'Faible' },
        { pct: 60,  color: '#eab308', text: 'Moyen' },
        { pct: 80,  color: '#22c55e', text: 'Fort' },
        { pct: 100, color: '#16a34a', text: 'Très fort' },
    ];
    const lvl = levels[score] || levels[0];
    strengthFill.style.width    = lvl.pct + '%';
    strengthFill.style.background = lvl.color;
    strengthLabel.textContent   = pw.length === 0
        ? 'Min. 8 caractères, dont un chiffre'
        : lvl.text;
    strengthLabel.style.color   = lvl.color === '#e5e7eb' ? '#9ca3af' : lvl.color;
}

/* ── Toggle password visibility ───────────────────── */
function bindToggle(btnId, iconId, inputId) {
    document.getElementById(btnId).addEventListener('click', () => {
        const input = document.getElementById(inputId);
        const icon  = document.getElementById(iconId);
        const show  = input.type === 'password';
        input.type  = show ? 'text' : 'password';
        icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
}
bindToggle('toggle-new',     'icon-new',     'new-password');
bindToggle('toggle-confirm', 'icon-confirm', 'confirm-password');

/* ── Live feedback ─────────────────────────────────── */
newPassInput.addEventListener('input', () => {
    updateStrength(newPassInput.value);
    if (confirmInput.value) checkMatch();
});

confirmInput.addEventListener('input', checkMatch);

function checkMatch() {
    const mismatch = confirmInput.value && confirmInput.value !== newPassInput.value;
    matchError.classList.toggle('d-none', !mismatch);
    confirmInput.classList.toggle('is-invalid', mismatch);
    confirmInput.classList.toggle('is-valid',  !mismatch && confirmInput.value.length > 0);
}

/* ── Token extraction from URL ─────────────────────── */
function getToken() {
    return new URLSearchParams(window.location.search).get('token') || '';
}

/* ── Validate token on load ────────────────────────── */
async function validateToken(token) {
    if (!token) {
        showStep('step-invalid');
        return false;
    }

    try {
        const res = await fetch(
            `${API_BASE_URL}/auth/validate-reset-token?token=${encodeURIComponent(token)}`,
            { method: 'GET' }
        );

        if (res.ok) {
            showStep('step-form');
            return true;
        }

        // Token invalid / expired
        showStep('step-invalid');
        return false;
    } catch {
        // Cannot reach server — still show the form and let submit handle the error
        showStep('step-form');
        return true;
    }
}

/* ── Form submit ───────────────────────────────────── */
resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const token      = getToken();
    const newPassword = newPassInput.value;
    const confirm    = confirmInput.value;

    // Validate password format
    if (!PASSWORD_REGEX.test(newPassword)) {
        showAlert('Le mot de passe doit contenir au moins 8 caractères et un chiffre.');
        newPassInput.focus();
        return;
    }

    // Confirm match
    if (newPassword !== confirm) {
        matchError.classList.remove('d-none');
        confirmInput.focus();
        return;
    }

    setLoading(true);

    try {
        const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            showStep('step-success');
            return;
        }

        if (res.status === 400 || res.status === 404) {
            // Token expired between validation and submit
            showStep('step-invalid');
            return;
        }

        throw new Error(data.message || 'Une erreur est survenue. Réessayez.');
    } catch (err) {
        if (err.name === 'TypeError') {
            showAlert('Impossible de contacter le serveur. Vérifiez votre connexion.');
        } else {
            showAlert(err.message);
        }
    } finally {
        setLoading(false);
    }
});

/* ── Boot ──────────────────────────────────────────── */
validateToken(getToken());
