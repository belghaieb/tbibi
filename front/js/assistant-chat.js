document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.TBIBI_API_BASE || 'http://localhost:8084/api';
    const ACCESS_TOKEN_KEY = 'tbibi_access_token';

    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem('tbibi_user'));
        } catch (error) {
            return null;
        }
    })();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

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

    const appendLoadingMessage = () => {
        const message = document.createElement('div');
        message.className = 'assistant-message bot loading';
        message.textContent = 'Envoi en cours...';
        stream.appendChild(message);
        stream.scrollTop = stream.scrollHeight;
        return message;
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const question = input.value.trim();
        if (!question) {
            return;
        }

        appendMessage(question, 'user');
        input.value = '';
        const loadingMessage = appendLoadingMessage();

        try {
            const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
            const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
                },
                body: JSON.stringify({ message: question })
            });

            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'login.html';
                return;
            }

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Assistant indisponible pour le moment.');
            }

            loadingMessage.remove();
            appendMessage(payload.reply || payload.message || 'Réponse reçue.', 'bot');
        } catch (error) {
            loadingMessage.remove();
            console.error(error);
            appendMessage("L'assistant est temporairement indisponible.", 'bot');
        }
    });
});
