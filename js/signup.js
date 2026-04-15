// Signup validation and doctor verification logic.
// Connects the signup page to Spring backend APIs.

const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';

const PHONE_REGEX = /^\+216\d{8}$/;
const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;

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
    const params = new URLSearchParams(window.location.search);
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

    const normalizePhone = function(value) {
        return value.replace(/\s+/g, '');
    };

    const buildSignupJson = function(selectedSubscription) {
        const body = {
            firstName: firstNameInput.value.trim(),
            lastName: lastNameInput.value.trim(),
            phone: normalizePhone(phoneInput.value.trim()),
            email: (emailInput?.value || '').trim(),
            password: passwordInput.value,
            role: roleSelect.value.toUpperCase(),
            subscriptionCode: selectedSubscription.toUpperCase()
        };
        if (roleSelect.value === 'doctor') {
            body.specialty = (document.getElementById('signupSpecialty')?.value || '').trim() || null;
            body.experienceYears = parseInt(document.getElementById('signupExperienceYears')?.value || '0', 10) || null;
            body.bio = (document.getElementById('signupBio')?.value || '').trim() || null;
        }
        return body;
    };

    const uploadDoctorDocs = async function(doctorId) {
        if (!doctorIdFileInput?.files[0]) return;
        const data = new FormData();
        data.append('doctorId', doctorId);
        data.append('idCard', doctorIdFileInput.files[0]);
        if (doctorDiplomaFileInput?.files[0]) data.append('diploma', doctorDiplomaFileInput.files[0]);
        if (doctorLicenseFileInput?.files[0]) data.append('license', doctorLicenseFileInput.files[0]);
        await fetch(`${API_BASE_URL}/uploads/doctor-docs`, { method: 'POST', body: data });
    };

    const uploadPatientFiles = async function(patientId) {
        if (!patientMedicalFilesInput?.files.length) return;
        const data = new FormData();
        data.append('patientId', patientId);
        [...patientMedicalFilesInput.files].forEach((file) => data.append('files', file));
        await fetch(`${API_BASE_URL}/uploads/patient-medical-files`, { method: 'POST', body: data });
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
        let namesAreValid = true;
        let passwordsMatch = true;
        let phoneIsValid = true;
        const normalizedPhone = normalizePhone(phoneInput.value.trim());

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

        if (!PASSWORD_REGEX.test(passwordInput.value)) {
            passwordsMatch = false;
            passwordInput.setCustomValidity('Le mot de passe doit contenir au moins 8 caractères et un chiffre.');
        } else {
            passwordInput.setCustomValidity('');
        }

        if (!PHONE_REGEX.test(normalizedPhone)) {
            phoneIsValid = false;
            phoneInput.setCustomValidity('Veuillez entrer un numéro tunisien valide au format +216XXXXXXXX.');
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
            const jsonBody = buildSignupJson(selectedSubscription);
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jsonBody)
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Inscription impossible pour le moment.');
            }

            // Upload files after successful registration
            if (roleSelect.value === 'doctor' && payload.id) {
                await uploadDoctorDocs(payload.id);
            }
            if (roleSelect.value === 'patient' && payload.id) {
                await uploadPatientFiles(payload.id);
            }

            if (payload.accessToken) {
                localStorage.setItem('tbibi_access_token', payload.accessToken);
            }
            localStorage.setItem('tbibi_user', JSON.stringify(payload));

            // Redirect to payment page so user can confirm their plan
            // paiement.html will call /checkout-session and then redirect to main.html
            const price = resolvePlanPrice(selectedSubscription);
            window.location.href = `paiement.html?plan=${selectedSubscription}&price=${price}`;
        } catch (error) {
            console.error(error);
            showError(error.message || 'Une erreur est survenue pendant l\'inscription.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    }, false);
});
