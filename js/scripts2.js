// This code goes inside your ../js/scripts.js file

// --- Helper Function ---
const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIN PAGE LOGIC (Kept for login.html) ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // ... (login page logic for redirection and plan passing) ...
        const planCode = getUrlParameter('plan');
        const planPrice = getUrlParameter('price');
        const planExists = planCode && planPrice;
        const signupLink = document.getElementById('signup-link');

        if (planExists) {
            document.getElementById('plan-input').value = planCode;
            document.getElementById('price-input').value = planPrice;
            signupLink.href = `signup.html?plan=${planCode}&price=${planPrice}`;
        }
        
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            let targetUrl = 'main.html';
            if (planExists) {
                targetUrl = `paiement.html?plan=${planCode}&price=${planPrice}`;
            } 
            window.location.href = targetUrl;
        });
    }

    // --- FORGOTTEN PASSWORD LOGIC (Reset Simulation) ---
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        
        // Hide elements that will be replaced by the success message
        document.getElementById('intro-text').style.display = 'block';
        document.getElementById('form-separator').style.display = 'block';
        document.getElementById('login-link-container').style.display = 'block';

        resetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email').value;
            const cardBody = resetForm.closest('.auth-card');
            const supportEmail = 'support@tbibi.com';

            // 1. Hide the form and its introductory text
            document.getElementById('intro-text').style.display = 'none';
            resetForm.style.display = 'none';
            document.getElementById('form-separator').style.display = 'none';
            document.getElementById('login-link-container').style.display = 'none';

            // 2. Create and display the success message
            const successMessage = document.createElement('div');
            successMessage.innerHTML = `
                <div class="alert alert-success mt-3" role="alert">
                    <h4 class="alert-heading">Email Envoyé! 📧</h4>
                    <p>Si l'adresse <strong>${emailInput}</strong> est associée à un compte, un lien de réinitialisation a été envoyé.</p>
                    <p class="mb-2 small">
                        <strong>Simulation de l'envoi:</strong> Pour cet environnement de démonstration, 
                        vous devez envoyer manuellement un email à <strong>${supportEmail}</strong>.
                    </p>
                    <button id="copy-btn" class="btn btn-sm btn-outline-success">
                        Copier l'email du support
                    </button>
                </div>
                <a href="login.html" class="btn btn-primary-theme w-100 mt-3">Retour à la Connexion</a>
            `;
            
            // Insert the new message before the old separator/link
            cardBody.appendChild(successMessage);
            
            // 3. Add Copy-to-Clipboard functionality
            document.getElementById('copy-btn').addEventListener('click', () => {
                navigator.clipboard.writeText(supportEmail).then(() => {
                    document.getElementById('copy-btn').textContent = 'Copié! 🎉';
                    setTimeout(() => {
                        document.getElementById('copy-btn').textContent = 'Copier l\'email du support';
                    }, 2000);
                }).catch(err => {
                    console.error('Could not copy text: ', err);
                });
            });
            
            return false;
        });
    }

    // --- (Other page logic would follow here) ---
});