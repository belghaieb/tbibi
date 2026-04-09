// Signup validation and doctor verification logic.
// Connects the signup page to Spring backend APIs.

const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8080/api';

window.validateTextOnly = function(event) {
    if (/[0-9]/.test(event.key)) {
        event.preventDefault();
    }
};

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('signup-form');
    const firstNameInput = document.getElementById('signupFirstName');
    const lastNameInput = document.getElementById('signupLastName');
    const emailInput = document.getElementById('signupEmail');
    const passwordInput = document.getElementById('signupPassword');
    const confirmPasswordInput = document.getElementById('signupConfirmPassword');
    const phoneInput = document.getElementById('signupPhone');
    const roleSelect = document.getElementById('signupRole');
    const termsCheck = document.getElementById('termsCheck');

    if (!form) {
        return;
    }

    const doctorDocsBlock = document.getElementById('doctorDocsBlock');
    const doctorDocsStatus = document.getElementById('doctorDocsStatus');
    const openDoctorModalBtn = document.getElementById('openDoctorModalBtn');
    const saveDoctorDocsBtn = document.getElementById('saveDoctorDocsBtn');
    const doctorIdFileInput = document.getElementById('doctorIdFile');
    const doctorDiplomaFileInput = document.getElementById('doctorDiplomaFile');
    const doctorLicenseFileInput = document.getElementById('doctorLicenseFile');
    const doctorDocsModalElement = document.getElementById('doctorDocsModal');
    const doctorDocsModal = doctorDocsModalElement ? new bootstrap.Modal(doctorDocsModalElement) : null;

    const patientFilesBlock = document.getElementById('patientFilesBlock');
    const patientMedicalFilesInput = document.getElementById('patientMedicalFiles');
    const patientFilesStatus = document.getElementById('patientFilesStatus');
    let doctorDocsValidated = false;

    firstNameInput?.addEventListener('keypress', validateTextOnly);
    lastNameInput?.addEventListener('keypress', validateTextOnly);

    const isDoctorDocsComplete = function() {
        return Boolean(
            doctorIdFileInput?.files.length &&
            doctorDiplomaFileInput?.files.length &&
            doctorLicenseFileInput?.files.length
        );
    };

    const validateDoctorDocsFields = function() {
        const idOk = (doctorIdFileInput?.files.length || 0) > 0;
        const diplomaOk = (doctorDiplomaFileInput?.files.length || 0) > 0;
        const licenseOk = (doctorLicenseFileInput?.files.length || 0) > 0;

        doctorIdFileInput?.classList.toggle('is-invalid', !idOk);
        doctorDiplomaFileInput?.classList.toggle('is-invalid', !diplomaOk);
        doctorLicenseFileInput?.classList.toggle('is-invalid', !licenseOk);

        return idOk && diplomaOk && licenseOk;
    };

    const resetDoctorDocs = function() {
        doctorDocsValidated = false;
        if (doctorIdFileInput) doctorIdFileInput.value = '';
        if (doctorDiplomaFileInput) doctorDiplomaFileInput.value = '';
        if (doctorLicenseFileInput) doctorLicenseFileInput.value = '';
        doctorIdFileInput?.classList.remove('is-invalid');
        doctorDiplomaFileInput?.classList.remove('is-invalid');
        doctorLicenseFileInput?.classList.remove('is-invalid');
        doctorDocsStatus?.classList.add('d-none');
    };

    const resetPatientFiles = function() {
        if (!patientMedicalFilesInput || !patientFilesStatus) {
            return;
        }

        patientMedicalFilesInput.value = '';
        patientFilesStatus.textContent = 'Aucun fichier sélectionné.';
        patientFilesStatus.classList.add('d-none');
    };

    const showError = function(message) {
        let box = document.getElementById('signup-error-message');
        if (!box) {
            box = document.createElement('div');
            box.id = 'signup-error-message';
            box.className = 'alert alert-danger mt-3';
            form.appendChild(box);
        }
        box.textContent = message;
        box.classList.remove('d-none');
    };

    const clearError = function() {
        const box = document.getElementById('signup-error-message');
        if (box) {
            box.textContent = '';
            box.classList.add('d-none');
        }
    };

    const resolvePlanPrice = function(planCode) {
        return planCode === 'basic' ? '60' : '90';
    };

    const buildSignupFormData = function(selectedSubscription) {
        const data = new FormData();
        data.append('firstName', firstNameInput.value.trim());
        data.append('lastName', lastNameInput.value.trim());
        data.append('phone', phoneInput.value.trim());
        data.append('email', (emailInput?.value || '').trim());
        data.append('password', passwordInput.value);
        data.append('role', roleSelect.value.toUpperCase());
        data.append('subscriptionPlan', selectedSubscription.toUpperCase());
        data.append('termsAccepted', String(Boolean(termsCheck?.checked)));

        if (roleSelect.value === 'doctor') {
            if (doctorIdFileInput?.files[0]) {
                data.append('doctorIdDocument', doctorIdFileInput.files[0]);
            }
            if (doctorDiplomaFileInput?.files[0]) {
                data.append('doctorDiplomaDocument', doctorDiplomaFileInput.files[0]);
            }
            if (doctorLicenseFileInput?.files[0]) {
                data.append('doctorLicenseDocument', doctorLicenseFileInput.files[0]);
            }
        }

        if (roleSelect.value === 'patient' && patientMedicalFilesInput) {
            [...patientMedicalFilesInput.files].forEach((file) => {
                data.append('medicalFiles', file);
            });
        }

        return data;
    };

    roleSelect?.addEventListener('change', function () {
        if (roleSelect.value === 'doctor') {
            doctorDocsBlock?.classList.remove('d-none');
            patientFilesBlock?.classList.add('d-none');
            resetPatientFiles();
            doctorDocsModal?.show();
            return;
        }

        if (roleSelect.value === 'patient') {
            doctorDocsBlock?.classList.add('d-none');
            resetDoctorDocs();
            patientFilesBlock?.classList.remove('d-none');
            return;
        }

        doctorDocsBlock?.classList.add('d-none');
        patientFilesBlock?.classList.add('d-none');
        resetDoctorDocs();
        resetPatientFiles();
    });

    if (patientMedicalFilesInput && patientFilesStatus) {
        patientMedicalFilesInput.addEventListener('change', function () {
            const fileCount = patientMedicalFilesInput.files.length;
            if (!fileCount) {
                patientFilesStatus.textContent = 'Aucun fichier sélectionné.';
                patientFilesStatus.classList.add('d-none');
                return;
            }

            patientFilesStatus.textContent = `${fileCount} fichier(s) sélectionné(s).`;
            patientFilesStatus.classList.remove('d-none');
        });
    }

    openDoctorModalBtn?.addEventListener('click', function () {
        doctorDocsModal?.show();
    });

    saveDoctorDocsBtn?.addEventListener('click', function () {
        if (!validateDoctorDocsFields()) {
            return;
        }

        doctorDocsValidated = true;
        doctorDocsStatus?.classList.remove('d-none');
        doctorDocsModal?.hide();
    });

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        event.stopPropagation();
        clearError();

        const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
        const tunisianPhoneRegex = /^\+216\s?\d{2}\s?\d{3}\s?\d{3}$/;
        let namesAreValid = true;
        let passwordsMatch = true;
        let phoneIsValid = true;

        if (!nameRegex.test(firstNameInput.value) || !nameRegex.test(lastNameInput.value)) {
            namesAreValid = false;

            if (!nameRegex.test(firstNameInput.value)) {
                firstNameInput.setCustomValidity('Le prénom ne doit contenir que des lettres.');
            }
            if (!nameRegex.test(lastNameInput.value)) {
                lastNameInput.setCustomValidity('Le nom ne doit contenir que des lettres.');
            }
        } else {
            firstNameInput.setCustomValidity('');
            lastNameInput.setCustomValidity('');
        }

        if (passwordInput.value !== confirmPasswordInput.value) {
            passwordsMatch = false;
            confirmPasswordInput.setCustomValidity('Les mots de passe ne correspondent pas.');
        } else {
            confirmPasswordInput.setCustomValidity('');
        }

        if (!tunisianPhoneRegex.test(phoneInput.value.trim())) {
            phoneIsValid = false;
            phoneInput.setCustomValidity('Veuillez entrer un numéro tunisien valide (ex: +216 22 123 456).');
        } else {
            phoneInput.setCustomValidity('');
        }

        if (roleSelect.value === 'doctor') {
            doctorDocsValidated = doctorDocsValidated && isDoctorDocsComplete();
            if (!doctorDocsValidated) {
                doctorDocsModal?.show();
                validateDoctorDocsFields();
            }
        }

        form.classList.add('was-validated');

        if (!form.checkValidity() || !namesAreValid || !passwordsMatch || !phoneIsValid || (roleSelect.value === 'doctor' && !doctorDocsValidated)) {
            return;
        }

        const selectedSubscription = document.querySelector('input[name="abonnement"]:checked')?.value || 'premium';
        const submitButton = form.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            const formData = buildSignupFormData(selectedSubscription);
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                body: formData
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Inscription impossible pour le moment.');
            }

            const planPrice = resolvePlanPrice(selectedSubscription);
            window.location.href = `paiement.html?plan=${encodeURIComponent(selectedSubscription)}&price=${encodeURIComponent(planPrice)}`;
        } catch (error) {
            showError(error.message || 'Une erreur est survenue pendant l\'inscription.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    }, false);
});
