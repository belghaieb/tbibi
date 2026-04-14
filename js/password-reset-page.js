// Password reset request flow in demo mode.

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

        document.getElementById('intro-text').style.display = 'none';
        resetForm.style.display = 'none';
        document.getElementById('form-separator').style.display = 'none';
        document.getElementById('login-link-container').style.display = 'none';

        const successMessage = document.createElement('div');
        successMessage.innerHTML = `
            <div class="alert alert-success mt-3" role="alert">
                <h4 class="alert-heading">Demande enregistrée</h4>
                <p>Mode démo: aucun email n'est envoyé, mais la demande pour ${emailInput || 'votre adresse'} a bien été prise en compte.</p>
            </div>
            <a href="login.html" class="btn btn-primary-theme w-100 mt-3">Retour à la Connexion</a>
        `;

        cardBody.appendChild(successMessage);

        return false;
    });
});
