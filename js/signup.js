// File: ../js/signup.js

/**
 * Empêche l'entrée de chiffres dans un champ de texte (Nom/Prénom).
 * @param {KeyboardEvent} event
 */
window.validateTextOnly = function(event) {
    // Empêche l'action si la clé pressée est un chiffre.
    if (/[0-9]/.test(event.key)) {
        event.preventDefault();
    }
};

// --- Logique de validation du formulaire ---
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('signup-form');
    const firstNameInput = document.getElementById('signupFirstName');
    const lastNameInput = document.getElementById('signupLastName');

    // Appliquer la validation en temps réel sur les champs Nom et Prénom
    firstNameInput.addEventListener('keypress', validateTextOnly);
    lastNameInput.addEventListener('keypress', validateTextOnly);

    form.addEventListener('submit', function (event) {
        event.preventDefault(); 
        event.stopPropagation();

        // Regex pour valider que seuls les lettres et caractères spéciaux de nom sont présents
        const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
        let namesAreValid = true;
        
        // Validation des champs Nom et Prénom lors de la soumission
        if (!nameRegex.test(firstNameInput.value) || !nameRegex.test(lastNameInput.value)) {
            namesAreValid = false;
            
            if (!nameRegex.test(firstNameInput.value)) {
                firstNameInput.setCustomValidity("Le prénom ne doit contenir que des lettres.");
            }
            if (!nameRegex.test(lastNameInput.value)) {
                lastNameInput.setCustomValidity("Le nom ne doit contenir que des lettres.");
            }
        } else {
            // Réinitialiser la validité custom si tout est bon
            firstNameInput.setCustomValidity("");
            lastNameInput.setCustomValidity("");
        }

        form.classList.add('was-validated'); 

        // Vérifier la validité globale du formulaire (incluant notre custom check)
        if (form.checkValidity() && namesAreValid) {
            
            // Collecte des données
            const firstName = firstNameInput.value;
            const role = document.getElementById('signupRole').value;
            const selectedSubscription = document.querySelector('input[name="abonnement"]:checked').value;
            
            // SUCCESS (Simulation)
            console.log(`User sign up details: ${firstName}, Role: ${role}, Subscription: ${selectedSubscription}`);
            
            alert(`Inscription de ${firstName} réussie! Redirection...`);
            
            // Redirection
            setTimeout(() => {
                window.location.href = 'login.html'; 
            }, 800);
            
        } else {
            // FAILURE (Validation Échouée)
            console.log("Validation failed. Please check all required fields.");
        }
    }, false);
});