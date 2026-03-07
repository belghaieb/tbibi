document.addEventListener('DOMContentLoaded', () => {
    // --- Define Main DOM Elements ---
    const doctorNavCards = document.querySelectorAll('.doctor-nav-card[data-doctor-id]');
    const doctorSummaryView = document.getElementById('doctor-summary-view');
    const chatView = document.getElementById('chat-view');
    const fileIframe = document.getElementById('medical-file-iframe');
    const currentFileTitle = document.getElementById('current-file-title');s
    const chatDoctorName = document.getElementById('chat-doctor-name'); // NEW ELEMENT


    // --- Data Store ---
    const doctorsData = {
        'dr-leila': {
            name: 'Dr. Leila Ben Salem',
            specialty: 'Cardiologue',
            experience: '18 Ans',
            status: 'Occupée',
            description: 'Experte en électrocardiogrammes et suivi post-opératoire. Toujours à l\'écoute de ses patients.',
            image: '../assets/ichrak.png' 
        },
        'dr-karim': {
            name: 'Dr. Karim Ali',
            specialty: 'Pédiatre',
            experience: '10 Ans',
            status: 'En Ligne',
            description: 'Spécialisé dans la santé infantile et les vaccinations. Approche douce et rassurante.',
            image: '../assets/images.jpg'
        },
        'dr-yasmine': {
            name: 'Dr. Yasmine Fethi',
            specialty: 'Généraliste',
            experience: '5 Ans',
            status: 'En Ligne',
            description: 'Médecin généraliste pour les soins primaires et les bilans de santé annuels.',
            image: '../assets/oumayma.png'
        }
    };


    // --- 1. Doctor View Management ---

    function updateDoctorView(doctorId) {
        // Switch back to summary view if we are in chat
        if (chatView.classList.contains('d-block')) {
            toggleInteractionView('summary');
        }

        const data = doctorsData[doctorId];
        if (!data) return;

        // Update Summary Details
        document.getElementById('doctor-title').textContent = data.name;
        document.getElementById('doctor-specialty').textContent = data.specialty;
        document.getElementById('doctor-experience').textContent = `${data.experience} Expérience`;
        document.getElementById('doctor-description').textContent = data.description;
        document.getElementById('doctor-avatar-summary').src = data.image;
        document.getElementById('doctor-avatar-summary').alt = data.name;
        
        // Update the Chat Doctor Name for the chat header
        chatDoctorName.textContent = data.name;

        // Update Status Badge
        const statusBadge = document.getElementById('doctor-status');
        statusBadge.textContent = data.status;
        statusBadge.classList.remove('bg-success', 'bg-warning');
        statusBadge.classList.add(data.status === 'En Ligne' ? 'bg-success' : 'bg-warning');

        // Update Active Card
        doctorNavCards.forEach(card => card.classList.remove('active-doctor'));
        document.querySelector(`.doctor-nav-card[data-doctor-id="${doctorId}"]`).classList.add('active-doctor');
    }


    // --- 2. Interaction Toggles (Chat / Summary) ---

    function toggleInteractionView(view) {
        if (view === 'chat') {
            doctorSummaryView.classList.replace('d-block', 'd-none');
            chatView.classList.replace('d-none', 'd-block');
        } else { // 'summary' or default
            doctorSummaryView.classList.replace('d-none', 'd-block');
            chatView.classList.replace('d-block', 'd-none');
            // Re-run updateDoctorView to refresh the summary header
            const currentDoctorId = document.querySelector('.doctor-nav-card.active-doctor')?.dataset.doctorId || 'dr-leila';
            updateDoctorView(currentDoctorId);
        }
    }


    // --- 3. File Viewer Management ---

    window.loadFile = function(fileName, event) {
        event.preventDefault(); 
        
        let filePath = '';
        let displayTitle = '';
        
        if (fileName === 'rapport.pdf') {
            filePath = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
            displayTitle = 'Rapport d\'analyse.pdf';
        } else if (fileName === 'ordonnance.jpg') {
            filePath = 'https://via.placeholder.com/600x400/D3D3D3/000000?text=Ordonnance-JPEG';
            displayTitle = 'Ordonnance - 01/12/2025.jpg';
        } else if (fileName === 'echographie-link') {
            filePath = 'https://www.w3.org/'; 
            displayTitle = 'Échographie (Viewer Link)';
        } else {
             filePath = 'placeholder.pdf';
             displayTitle = 'Aucun Fichier Séléctionné';
        }

        fileIframe.src = filePath;
        currentFileTitle.textContent = displayTitle;

        // Highlight the active file
        document.querySelectorAll('.file-history-list .list-group-item-action').forEach(item => item.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }


    // --- 4. Event Handlers ---

    // Doctor Card Clicks
    doctorNavCards.forEach(card => {
        card.addEventListener('click', () => {
            const doctorId = card.dataset.doctorId;
            if (doctorId) {
                updateDoctorView(doctorId);
            } else if (card.dataset.action === 'reports') {
                alert('Afficher la section des rapports généraux.');
            }
        });
    });

    // Action Button Clicks
    window.handleAction = function(actionType) {
        if (actionType === 'Message Direct') {
            toggleInteractionView('chat');
        } else if (actionType === 'BackToSummary') {
            toggleInteractionView('summary');
        } else if (actionType === 'Consultation Vidéo') {
            alert('Démarrage de la consultation vidéo avec le docteur...');
        } else if (actionType === 'Planifier RDV') {
            alert('Ouverture du module de planification de RDV...');
        }
    };
    
    // Initial Load
    updateDoctorView('dr-leila'); 
    loadFile('rapport.pdf', {preventDefault: () => {}}); 
});