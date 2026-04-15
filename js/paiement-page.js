// Payment page connected to Spring backend subscription checkout endpoint.

const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';
const ACCESS_TOKEN_KEY = 'tbibi_access_token';

const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};

function formatCardNumberInput(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
        parts.push(digits.slice(i, i + 4));
    }
    return parts.join(' ');
}

function formatExpiryInput(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan') || 'premium';
    const price = params.get('price') || '90';

    const labelEl = document.getElementById('pay-plan-label');
    const codeEl = document.getElementById('pay-plan-code');
    const amountEl = document.getElementById('pay-amount');

    const planLabel = plan === 'basic' ? 'Essentiel' : 'Premium';
    const planCode = plan.toUpperCase();
    const amountDisplay = plan === 'basic' ? '60 TND' : `${price} TND/mois`;

    if (labelEl) labelEl.textContent = planLabel;
    if (codeEl) codeEl.textContent = planCode;
    if (amountEl) amountEl.textContent = amountDisplay;

    const displayNum = document.getElementById('display-card-number');
    const displayHolder = document.getElementById('display-holder');
    const displayExpiry = document.getElementById('display-expiry');

    const cardName = document.getElementById('card-name');
    const cardNumber = document.getElementById('card-number');
    const cardExpiry = document.getElementById('card-expiry');
    const cardCvc = document.getElementById('card-cvc');
    const form = document.getElementById('fake-payment-form');

    if (cardNumber) {
        cardNumber.addEventListener('input', () => {
            cardNumber.value = formatCardNumberInput(cardNumber.value);
            const masked = cardNumber.value || '•••• •••• •••• ••••';
            if (displayNum) displayNum.textContent = masked;
        });
    }

    if (cardExpiry) {
        cardExpiry.addEventListener('input', () => {
            cardExpiry.value = formatExpiryInput(cardExpiry.value);
            if (displayExpiry) {
                displayExpiry.textContent = cardExpiry.value || 'MM/AA';
            }
        });
    }

    if (cardName) {
        cardName.addEventListener('input', () => {
            const v = cardName.value.trim().toUpperCase() || 'NOM PRÉNOM';
            if (displayHolder) displayHolder.textContent = v;
        });
    }

    if (cardCvc) {
        cardCvc.addEventListener('input', () => {
            cardCvc.value = cardCvc.value.replace(/\D/g, '').slice(0, 4);
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('pay-submit-btn');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const token = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
                const response = await fetch(`${API_BASE_URL}/subscriptions/checkout-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ planCode: planCode })
                });

                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                    return;
                }

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Paiement impossible pour le moment.');
                }

                if (data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                } else {
                    window.location.href = 'main.html';
                }
            } catch (err) {
                console.error(err);
                const errorEl = document.getElementById('pay-error');
                if (errorEl) {
                    errorEl.textContent = err.message;
                    errorEl.classList.remove('d-none');
                } else {
                    alert(err.message);
                }
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
});
