// File: ../js/scripts.js (Contains all application logic, including main.html)

// Doctor data store (used for dynamic updates on doctor click)
const doctorData = {
    'dr-leila': {
        name: 'Dr. Ichrak Belghaieb',
        specialty: 'Geniechologue',
        status: 'En Ligne',
        experience: '11 Ans Expérience',
        description: 'Dr. Ichrak is a gynecologist who specializes in womens reproductive health, offering consultations, check-ups, and medical or surgical treatments for conditions affecting the uterus, ovaries, cervix, and vagina, while also providing personalized advice on contraception, fertility, pregnancy follow-up, sexually transmitted infections, and menopause management to help women maintain their well-being at every stage of life.',
        avatar: '../assets/ichrak.png'
    },
    'dr-karim': {
        name: 'Dr. Karim Tounsi',
        specialty: 'Pédiatre',
        status: 'Absent',
        experience: '10 Ans Expérience',
        description: "Spécialiste de la petite enfance, il/elle propose des consultations axées sur la prévention, le dépistage précoce et le suivi du développement global de l’enfant croissance, éveil, langage, motricité et émotions, en accompagnant les parents par des conseils personnalisés pour favoriser un environnement sécurisé, stimulant et adapté à chaque étape de la petite enfance",
        avatar: '../assets/images.jpg'
    },
    'dr-yasmine': {
        name: 'Dr. Oumayama belghaieb',
        specialty: 'Généraliste',
        status: 'En Ligne',
        experience: '7 Ans Expérience',
        description: 'Oumayma est médecin généraliste, première interlocutrice de ses patients pour leurs besoins de santé au quotidien, assurant la prise en charge des soins primaires, le diagnostic des maladies courantes, la prévention, le suivi des pathologies chroniques et l’orientation vers les spécialistes lorsque cela est nécessaire',
        avatar: '../assets/oumayma.png'
    }
};

// --- Helper function to update the doctor summary details ---
function updateDoctorView(doctorId) {
    const doctor = doctorData[doctorId];
    
    if (doctor) {
        document.getElementById('doctor-title').textContent = doctor.name;
        document.getElementById('doctor-avatar-summary').src = doctor.avatar;
        document.getElementById('doctor-avatar-summary').alt = doctor.name;
        document.getElementById('doctor-specialty').textContent = doctor.specialty;
        document.getElementById('doctor-experience').textContent = doctor.experience;
        document.getElementById('doctor-description').textContent = doctor.description;
        
        const statusBadge = document.getElementById('doctor-status');
        statusBadge.textContent = doctor.status;
        statusBadge.className = `badge ${doctor.status === 'En Ligne' ? 'bg-success' : 'bg-secondary'}`;
    }
}

// --- File Loading Simulation ---
// File: ../js/scripts.js (Ensure loadFile looks like this)

// --- File Loading Simulation (Handles PDF/image loading) ---
window.loadFile = function(fileName, event) {
    event.preventDefault();
    
    const iframe = document.getElementById('medical-file-iframe');
    const fileTitle = document.getElementById('current-file-title');
    
    if (fileName.includes('.pdf') || fileName.includes('.png') || fileName.includes('.jpg') || fileName.includes('.jpeg')) {
        // Correctly load PDF or JPG
        iframe.src = `../assets/${fileName}`; 
        fileTitle.textContent = fileName.toUpperCase();
        
    } else {
         // Handle simulated links (like echographie-link)
         iframe.src = `about:blank`; 
         fileTitle.textContent = 'Fichier Externe (Démonstration)';
         iframe.contentWindow.document.write('<div style="text-align: center; padding: 20px; font-family: sans-serif;">Affichage du viewer non disponible en démo.</div>');
    }
    
    // Always reset scroll on the file viewer column
    document.querySelector('.file-viewer-area').scrollTop = 0;
};
// --- Doctor Summary & Chat View Toggle ---
window.handleAction = function(action) {
    const summaryView = document.getElementById('doctor-summary-view');
    const chatView = document.getElementById('chat-view');
    const activeDoctorCard = document.querySelector('.active-doctor');
    
    if (!activeDoctorCard) return; 

    const activeDoctorId = activeDoctorCard.getAttribute('data-doctor-id');
    const doctor = doctorData[activeDoctorId];

    if (action === 'Message Direct') {
        // Switch to chat view
        document.getElementById('chat-doctor-name').textContent = doctor.name;
        summaryView.classList.add('d-none');
        chatView.classList.remove('d-none');
        // Scroll chat messages to bottom
        const chatContainer = document.querySelector('.chat-messages-container');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

    } else if (action === 'BackToSummary') {
        // Switch back to summary view
        summaryView.classList.remove('d-none');
        chatView.classList.add('d-none');
        
    } else {
        // Handle other simulated button actions
        alert(`Action simulée: ${action} avec ${doctor.name}`);
    }
};


document.addEventListener('DOMContentLoaded', () => {
    
    // --- MAIN.HTML (Dashboard) Logic ---
    const doctorCards = document.querySelectorAll('.doctor-nav-card[data-doctor-id]');
    
    if (document.querySelector('.app-wrapper')) { // Check if we are on main.html
        
        // Initial setup: Load the default doctor's summary view
        updateDoctorView('dr-leila');

        // 1. Doctor Navigation Handling (Switching Doctor Profile)
        doctorCards.forEach(card => {
            card.addEventListener('click', () => {
                const doctorId = card.getAttribute('data-doctor-id');
                
                // a. Update active class on the list
                doctorCards.forEach(c => c.classList.remove('active-doctor'));
                card.classList.add('active-doctor');
                
                // b. Load the new doctor's profile/summary
                updateDoctorView(doctorId);
                
                // c. Ensure we are looking at the SUMMARY after switching
                document.getElementById('chat-view').classList.add('d-none');
                document.getElementById('doctor-summary-view').classList.remove('d-none');
            });
        });

        // 2. Chat Message Sending Simulation
        const chatInputField = document.getElementById('chat-input-field');
        const chatSendBtn = document.getElementById('chat-send-btn');
        const chatMessagesContainer = document.querySelector('.chat-messages-container');
        
        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', () => {
                const messageText = chatInputField.value.trim();
                if (messageText) {
                    // Add patient message
                    const patientMsg = document.createElement('div');
                    patientMsg.className = 'message patient-message';
                    patientMsg.textContent = messageText;
                    chatMessagesContainer.appendChild(patientMsg);
                    
                    // Simulate doctor response
                    setTimeout(() => {
                        const doctorMsg = document.createElement('div');
                        doctorMsg.className = 'message doctor-message';
                        doctorMsg.textContent = "J'ai bien reçu votre message. Je vous réponds dans quelques minutes après analyse.";
                        chatMessagesContainer.appendChild(doctorMsg);
                        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                    }, 1500);

                    chatInputField.value = '';
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                }
            });
            // Handle 'Enter' key press on input field
            chatInputField.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault(); 
                    chatSendBtn.click();
                }
            });
            // File: ../js/scripts.js (Add this new function)

/**
 * Toggles the full-screen mode for the medical file viewer area (the middle column).
 * This function is called by the new "Plein Écran" button in the HTML.
 */
window.toggleFullScreen = function() {
    const viewerArea = document.querySelector('.file-viewer-area');
    
    // Check if the browser is currently in full-screen mode for any element
    if (!document.fullscreenElement) {
        // Request full-screen for the whole middle column
        if (viewerArea.requestFullscreen) {
            viewerArea.requestFullscreen();
        } else if (viewerArea.webkitRequestFullscreen) { /* Safari */
            viewerArea.webkitRequestFullscreen();
        } else if (viewerArea.msRequestFullscreen) { /* IE11 */
            viewerArea.msRequestFullscreen();
        }
    } else {
        // If it is, exit full-screen mode
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
    }
}
        }
    }
    
    // --- Other pages' logic (login, signup, payment etc.) would follow here ---

});