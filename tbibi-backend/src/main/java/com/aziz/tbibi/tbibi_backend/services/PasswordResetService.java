package com.aziz.tbibi.tbibi_backend.services;

import com.aziz.tbibi.tbibi_backend.entities.PasswordResetToken;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.repositories.PasswordResetTokenRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserRepository               userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final JavaMailSender               mailSender;
    private final PasswordEncoder              passwordEncoder;

    @Value("${app.server.base-url}")
    private String serverBaseUrl;

    @Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    // ── Step 1: send reset email ──────────────────────────────────────────
    // Called by POST /api/auth/forgot-password { email }
    // Always returns without error even if email not found (security: no enumeration)
    @Transactional
    public void sendResetEmail(String email) {
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            // Don't reveal that the email doesn't exist
            return;
        }

        User user = userOpt.get();

        // Delete any existing tokens for this user (one active token at a time)
        tokenRepository.deleteByUser(user);

        // Generate a secure random token (UUID = 36-char hex string)
        String token = UUID.randomUUID().toString();

        // Save token with 15-minute expiry
        tokenRepository.save(
            PasswordResetToken.builder()
                .token(token)
                .user(user)
                .expiresAt(LocalDateTime.now().plusMinutes(15))
                .used(false)
                .build()
        );

        // Build the reset link pointing to the frontend reset page
        String resetLink = frontendBaseUrl + "/html/reset-password.html?token=" + token;

        // Send the HTML email
        sendHtmlEmail(user, resetLink);
    }

    // ── Step 2: validate token ────────────────────────────────────────────
    // Called by GET /api/auth/validate-reset-token?token=X
    // Returns true if token exists, is not expired, and has not been used
    public boolean isTokenValid(String token) {
        return tokenRepository.findByToken(token)
            .map(t -> !t.isUsed() && t.getExpiresAt().isAfter(LocalDateTime.now()))
            .orElse(false);
    }

    // ── Step 3: reset password ────────────────────────────────────────────
    // Called by POST /api/auth/reset-password { token, newPassword }
    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
            .orElseThrow(() -> new RuntimeException("Lien invalide ou expiré."));

        if (resetToken.isUsed()) {
            throw new RuntimeException("Ce lien a déjà été utilisé.");
        }

        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Ce lien a expiré. Demandez un nouveau.");
        }

        // Update the user's password
        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Mark token as used (one-time use)
        resetToken.setUsed(true);
        tokenRepository.save(resetToken);
    }

    // ── Email builder ─────────────────────────────────────────────────────
    private void sendHtmlEmail(User user, String resetLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(user.getEmail());
            helper.setSubject("TBIBI — Réinitialisation de votre mot de passe");

            String firstName = user.getFirstName();
            String html = """
                <!DOCTYPE html>
                <html lang="fr">
                <head><meta charset="UTF-8"></head>
                <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
                  <table width="100%%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
                    <tr><td align="center">
                      <table width="520" cellpadding="0" cellspacing="0"
                             style="background:#ffffff;border-radius:12px;
                                    box-shadow:0 2px 12px rgba(0,0,0,.08);overflow:hidden;">

                        <!-- Header -->
                        <tr>
                          <td style="background:linear-gradient(135deg,#0068c9,#08b158);
                                     padding:28px 36px;text-align:center;">
                            <span style="color:#fff;font-size:1.9rem;font-weight:800;
                                         letter-spacing:2px;">TBIBI</span>
                            <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:.9rem;">
                              Votre clinique virtuelle
                            </p>
                          </td>
                        </tr>

                        <!-- Body -->
                        <tr>
                          <td style="padding:36px 36px 28px;">
                            <p style="font-size:1rem;color:#1f2937;margin:0 0 12px;">
                              Bonjour <strong>%s</strong>,
                            </p>
                            <p style="font-size:.92rem;color:#4b5563;line-height:1.6;margin:0 0 24px;">
                              Nous avons reçu une demande de réinitialisation de mot de passe
                              pour votre compte TBIBI.<br>
                              Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
                              Ce lien est valable <strong>15 minutes</strong>.
                            </p>

                            <!-- Button -->
                            <table cellpadding="0" cellspacing="0" width="100%%">
                              <tr><td align="center" style="padding:8px 0 28px;">
                                <a href="%s"
                                   style="display:inline-block;background:linear-gradient(135deg,#0068c9,#0080f5);
                                          color:#fff;text-decoration:none;font-weight:700;
                                          font-size:.95rem;padding:14px 36px;border-radius:8px;
                                          letter-spacing:.3px;">
                                  Réinitialiser mon mot de passe
                                </a>
                              </td></tr>
                            </table>

                            <p style="font-size:.82rem;color:#9ca3af;margin:0 0 6px;">
                              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                            </p>
                            <p style="font-size:.78rem;color:#6b7280;word-break:break-all;margin:0 0 24px;">
                              %s
                            </p>

                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
                            <p style="font-size:.8rem;color:#9ca3af;margin:0;">
                              Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                              Votre mot de passe ne sera pas modifié.
                            </p>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="background:#f9fafb;padding:16px 36px;text-align:center;
                                     border-top:1px solid #e5e7eb;">
                            <p style="font-size:.78rem;color:#9ca3af;margin:0;">
                              &copy; 2026 TBIBI — Votre clinique virtuelle
                            </p>
                          </td>
                        </tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(firstName, resetLink, resetLink);

            helper.setText(html, true); // true = HTML email
            mailSender.send(message);

        } catch (Exception e) {
            // Log but don't expose mail errors to the client
            System.err.println("[PasswordResetService] Failed to send email to "
                + user.getEmail() + ": " + e.getMessage());
            throw new RuntimeException("Impossible d'envoyer l'email. Réessayez plus tard.");
        }
    }
}
