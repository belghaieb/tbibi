package com.aziz.tbibi.tbibi_backend.config;

import com.aziz.tbibi.tbibi_backend.entities.DoctorProfile;
import com.aziz.tbibi.tbibi_backend.entities.Subscription;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.Role;
import com.aziz.tbibi.tbibi_backend.enums.SubscriptionCode;
import com.aziz.tbibi.tbibi_backend.enums.VerificationStatus;
import com.aziz.tbibi.tbibi_backend.repositories.DoctorProfileRepository;
import com.aziz.tbibi.tbibi_backend.repositories.SubscriptionRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final DoctorProfileRepository doctorProfileRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seedSubscriptions();
        seedAdmin();
        seedDoctors();
    }

    private void seedSubscriptions() {
        if (subscriptionRepository.count() == 0) {
            subscriptionRepository.save(
                Subscription.builder()
                    .code(SubscriptionCode.BASIC)
                    .label("Essentiel")
                    .price(60.0)
                    .active(true)
                    .build()
            );
            subscriptionRepository.save(
                Subscription.builder()
                    .code(SubscriptionCode.PREMIUM)
                    .label("Premium")
                    .price(90.0)
                    .active(true)
                    .build()
            );
        }
    }

    private void seedAdmin() {
        if (!userRepository.existsByEmail("admin@tbibi.tn")) {
            userRepository.save(
                User.builder()
                    .firstName("Admin")
                    .lastName("Tbibi")
                    .email("admin@tbibi.tn")
                    .password(passwordEncoder.encode("Admin123"))
                    .phone("+21600000001")
                    .role(Role.ADMIN)
                    .build()
            );
        }
    }

    private void seedDoctors() {
        if (doctorProfileRepository.count() > 0) {
            return;
        }

        createDoctor("Sami",    "Ben Ali",    "sami.benali@tbibi.tn",    "Cardiologue",         12, "Cardiologue expérimenté spécialisé dans les maladies cardiovasculaires et l'hypertension.");
        createDoctor("Ines",    "Mansouri",   "ines.mansouri@tbibi.tn",  "Pédiatre",             8, "Pédiatre dévouée avec une expertise en développement de l'enfant et maladies infantiles.");
        createDoctor("Karim",   "Trabelsi",   "karim.trabelsi@tbibi.tn", "Dermatologue",        15, "Dermatologue spécialisé dans les maladies de la peau, allergies cutanées et cosmétologie médicale.");
        createDoctor("Fatma",   "Chaabane",   "fatma.chaabane@tbibi.tn", "Gynécologue",         10, "Gynécologue obstétricienne avec une approche bienveillante et un suivi personnalisé.");
        createDoctor("Mourad",  "Jebali",     "mourad.jebali@tbibi.tn",  "Médecin Généraliste",  6, "Médecin généraliste disponible pour consultations courantes, bilans de santé et orientations spécialisées.");
    }

    private void createDoctor(String firstName, String lastName, String email,
                               String specialty, int experienceYears, String bio) {
        User user = userRepository.save(
            User.builder()
                .firstName(firstName)
                .lastName(lastName)
                .email(email)
                .password(passwordEncoder.encode("Doctor123"))
                .phone("+21600000000")
                .role(Role.DOCTOR)
                .build()
        );

        doctorProfileRepository.save(
            DoctorProfile.builder()
                .user(user)
                .specialty(specialty)
                .experienceYears(experienceYears)
                .bio(bio)
                .verificationStatus(VerificationStatus.VERIFIED)
                .build()
        );
    }
}
