document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8080/api';
    const ACCESS_TOKEN_KEY = 'tbibi_access_token';

    const form = document.getElementById('assistant-form');
    const input = document.getElementById('assistant-input');
    const stream = document.getElementById('assistant-message-stream');

    if (!form || !input || !stream) {
        return;
    }

    const appendMessage = (text, kind) => {
        const message = document.createElement('div');
        message.className = `assistant-message ${kind}`;
        message.textContent = text;
        stream.appendChild(message);
        stream.scrollTop = stream.scrollHeight;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const question = input.value.trim();
        if (!question) {
            return;
        }

        appendMessage(question, 'user');
        input.value = '';

        try {
            const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
            const response = await fetch(`${API_BASE_URL}/assistant/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
                },
                body: JSON.stringify({ message: question })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Assistant indisponible pour le moment.');
            }

            appendMessage(payload.reply || payload.message || 'Réponse reçue.', 'bot');
        } catch (error) {
            appendMessage(error.message || 'Une erreur est survenue.', 'bot');
        }
    });
});
