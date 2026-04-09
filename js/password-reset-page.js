// Password reset request flow connected to Spring backend.

const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8080/api';

document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('reset-form');
    if (!resetForm) {
        return;
    }

    document.getElementById('intro-text').style.display = 'block';
    document.getElementById('form-separator').style.display = 'block';
    document.getElementById('login-link-container').style.display = 'block';

    resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById('email').value.trim();
        const cardBody = resetForm.closest('.auth-card');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: emailInput })
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.message || 'Impossible d\'envoyer la demande de réinitialisation.');
            }
        } catch (error) {
            const existingError = document.getElementById('reset-error-message');
            if (existingError) {
                existingError.textContent = error.message;
                existingError.classList.remove('d-none');
            } else {
                const box = document.createElement('div');
                box.id = 'reset-error-message';
                box.className = 'alert alert-danger mt-3';
                box.textContent = error.message;
                resetForm.appendChild(box);
            }
            return;
        }

        document.getElementById('intro-text').style.display = 'none';
        resetForm.style.display = 'none';
        document.getElementById('form-separator').style.display = 'none';
        document.getElementById('login-link-container').style.display = 'none';

        const successMessage = document.createElement('div');
        successMessage.innerHTML = `
            <div class="alert alert-success mt-3" role="alert">
                <h4 class="alert-heading">Email Envoyé! 📧</h4>
                <p>Si l'adresse <strong>${emailInput}</strong> est associée à un compte, un lien de réinitialisation a été envoyé.</p>
            </div>
            <a href="login.html" class="btn btn-primary-theme w-100 mt-3">Retour à la Connexion</a>
        `;

        cardBody.appendChild(successMessage);

        return false;
    });
});
