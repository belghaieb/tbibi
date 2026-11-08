// Login page logic for TBIBI.
// Connects the login form to a Spring backend.

const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';

document.addEventListener('DOMContentLoaded', () => {
    // Only run on the login page.
    const loginForm = document.getElementById('login-form');
    if (!loginForm) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const planCode = params.get('plan') || '';
    const planPrice = params.get('price') || '';
    const planExists = planCode && planPrice;
    const signupLink = document.getElementById('signup-link');

    // Preserve the selected subscription details for the sign-up link.
    if (planExists) {
        document.getElementById('plan-input').value = planCode;
        document.getElementById('price-input').value = planPrice;
        signupLink.href = `signup.html?plan=${encodeURIComponent(planCode)}&price=${encodeURIComponent(planPrice)}`;
    }

    const showError = (message) => {
        const existing = document.getElementById('login-error-message');
        if (existing) {
            existing.textContent = message;
            existing.classList.remove('d-none');
            return;
        }

        const errorBox = document.createElement('div');
        errorBox.id = 'login-error-message';
        errorBox.className = 'alert alert-danger mt-3 mb-0';
        errorBox.textContent = message;
        loginForm.appendChild(errorBox);
    };

    const clearError = () => {
        const existing = document.getElementById('login-error-message');
        if (existing) {
            existing.classList.add('d-none');
            existing.textContent = '';
        }
    };

    const saveSession = (payload) => {
        if (payload.accessToken) {
            localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
        }
        localStorage.setItem('tbibi_user', JSON.stringify(payload));
    };

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        clearError();

        const email = (document.getElementById('email')?.value || '').trim();
        const password = document.getElementById('password')?.value || '';
        const submitButton = loginForm.querySelector('button[type="submit"]');

        if (!email || !password) {
            showError('Veuillez saisir votre email et votre mot de passe.');
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const body = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(body.message || 'Connexion impossible. Vérifiez vos identifiants.');
            }

            saveSession(body);

            // Route to the correct page based on role:
            // ADMIN  → admin.html (user management panel, no payment)
            // DOCTOR → main.html (shared doctor/patient dashboard)
            // PATIENT → main.html, or paiement.html if coming from pricing page
            const role = (body.role || '').toUpperCase();

            const targetUrl = role === 'ADMIN' ? 'admin.html' : 'main.html';
            window.location.href = targetUrl;
        } catch (error) {
            console.error(error);
            showError(error.message || 'Une erreur est survenue pendant la connexion.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
});
