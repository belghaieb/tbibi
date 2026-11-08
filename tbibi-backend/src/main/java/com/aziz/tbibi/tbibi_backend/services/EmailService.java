package com.aziz.tbibi.tbibi_backend.services;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("EEEE d MMMM yyyy 'à' HH'h'mm", Locale.FRENCH);

    // ── Generic send helper ───────────────────────────────────────────────
    @Async
    public void send(String to, String subject, String htmlBody) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
            helper.setFrom(fromAddress, "TBIBI — Clinique Virtuelle");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(msg);
        } catch (Exception e) {
            System.err.println("[EmailService] Failed to send email to " + to + ": " + e.getMessage());
        }
    }

    // ── Appointment booked (to doctor) ───────────────────────────────────
    public void sendAppointmentBookedToDoctor(
            String doctorEmail, String doctorName,
            String patientName, LocalDateTime scheduledAt, String reason) {

        String date = scheduledAt.format(DATE_FMT);
        String subject = "Nouveau rendez-vous — " + patientName;
        String body = buildCard(
            "Nouveau rendez-vous",
            "Dr. " + doctorName,
            "Le patient <strong>" + patientName + "</strong> a pris rendez-vous avec vous.",
            new String[][]{
                {"Date & heure", date},
                {"Motif", reason != null && !reason.isBlank() ? reason : "Non précisé"}
            },
            null, null,
            "#0a9396"
        );
        send(doctorEmail, subject, body);
    }

    // ── Appointment booked (to patient) ──────────────────────────────────
    public void sendAppointmentBookedToPatient(
            String patientEmail, String patientName,
            String doctorName, String specialty,
            LocalDateTime scheduledAt, String reason) {

        String date = scheduledAt.format(DATE_FMT);
        String subject = "Confirmation de rendez-vous — Dr. " + doctorName;
        String body = buildCard(
            "Rendez-vous confirmé ✓",
            patientName,
            "Votre rendez-vous a bien été enregistré.",
            new String[][]{
                {"Médecin",    "Dr. " + doctorName + (specialty != null ? " — " + specialty : "")},
                {"Date & heure", date},
                {"Motif",     reason != null && !reason.isBlank() ? reason : "Non précisé"},
                {"Statut",    "EN ATTENTE DE CONFIRMATION"}
            },
            null, null,
            "#0a9396"
        );
        send(patientEmail, subject, body);
    }

    // ── Appointment confirmed (to patient) ───────────────────────────────
    public void sendAppointmentConfirmed(
            String patientEmail, String patientName,
            String doctorName, LocalDateTime scheduledAt) {

        String date = scheduledAt.format(DATE_FMT);
        String subject = "Rendez-vous confirmé par Dr. " + doctorName;
        String body = buildCard(
            "Rendez-vous confirmé ✓",
            patientName,
            "Dr. <strong>" + doctorName + "</strong> a confirmé votre rendez-vous.",
            new String[][]{
                {"Date & heure", date},
                {"Statut", "CONFIRMÉ"}
            },
            null, null,
            "#2da771"
        );
        send(patientEmail, subject, body);
    }

    // ── Appointment cancelled (to patient) ───────────────────────────────
    public void sendAppointmentCancelled(
            String patientEmail, String patientName,
            String doctorName, LocalDateTime scheduledAt) {

        String date = scheduledAt.format(DATE_FMT);
        String subject = "Rendez-vous annulé — Dr. " + doctorName;
        String body = buildCard(
            "Rendez-vous annulé",
            patientName,
            "Votre rendez-vous avec Dr. <strong>" + doctorName + "</strong> a été annulé.",
            new String[][]{
                {"Date & heure", date},
                {"Statut", "ANNULÉ"}
            },
            null, null,
            "#dc3545"
        );
        send(patientEmail, subject, body);
    }

    // ── Appointment cancelled (to doctor, by patient) ────────────────────
    public void sendAppointmentCancelledToDoctor(
            String doctorEmail, String doctorName,
            String patientName, LocalDateTime scheduledAt) {

        String date = scheduledAt.format(DATE_FMT);
        String subject = "Rendez-vous annulé — " + patientName;
        String body = buildCard(
            "Rendez-vous annulé",
            "Dr. " + doctorName,
            "Le patient <strong>" + patientName + "</strong> a annulé son rendez-vous.",
            new String[][]{
                {"Date & heure", date}
            },
            null, null,
            "#dc3545"
        );
        send(doctorEmail, subject, body);
    }

    // ── Appointment rescheduled (to doctor) ──────────────────────────────
    public void sendAppointmentRescheduled(
            String doctorEmail, String doctorName,
            String patientName,
            LocalDateTime oldDate, LocalDateTime newDate) {

        String subject = "Rendez-vous modifié — " + patientName;
        String body = buildCard(
            "Rendez-vous modifié",
            "Dr. " + doctorName,
            "Le patient <strong>" + patientName + "</strong> a déplacé son rendez-vous.",
            new String[][]{
                {"Ancien créneau", oldDate.format(DATE_FMT)},
                {"Nouveau créneau", newDate.format(DATE_FMT)}
            },
            null, null,
            "#f0821d"
        );
        send(doctorEmail, subject, body);
    }

    // ── HTML email card builder ───────────────────────────────────────────
    private String buildCard(
            String title, String recipientName, String intro,
            String[][] rows,
            String ctaLabel, String ctaUrl,
            String accentColor) {

        StringBuilder rowsHtml = new StringBuilder();
        if (rows != null) {
            for (String[] row : rows) {
                rowsHtml.append("""
                    <tr>
                      <td style="padding:6px 12px;color:#64748b;font-size:13px;white-space:nowrap;">%s</td>
                      <td style="padding:6px 12px;color:#1e293b;font-size:13px;font-weight:600;">%s</td>
                    </tr>
                    """.formatted(row[0], row[1]));
            }
        }

        String cta = (ctaLabel != null && ctaUrl != null) ? """
            <div style="text-align:center;margin-top:24px;">
              <a href="%s" style="background:%s;color:#fff;padding:12px 28px;border-radius:8px;
                 text-decoration:none;font-weight:700;font-size:14px;">%s</a>
            </div>
            """.formatted(ctaUrl, accentColor, ctaLabel) : "";

        return """
            <!DOCTYPE html>
            <html lang="fr"><head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr><td align="center" style="padding:32px 16px;">
                  <table width="560" cellpadding="0" cellspacing="0"
                         style="background:#fff;border-radius:16px;overflow:hidden;
                                box-shadow:0 4px 24px rgba(0,0,0,.08);">
                    <!-- Header -->
                    <tr>
                      <td style="background:%s;padding:28px 32px;">
                        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px;">
                          🏥 TBIBI
                        </div>
                        <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:2px;">
                          Clinique Virtuelle
                        </div>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:28px 32px;">
                        <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a;">%s</h2>
                        <p style="margin:0 0 16px;color:#475569;font-size:14px;">
                          Bonjour <strong>%s</strong>,
                        </p>
                        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">
                          %s
                        </p>
                        <!-- Info table -->
                        <table width="100%%" cellpadding="0" cellspacing="0"
                               style="background:#f8fafc;border-radius:10px;overflow:hidden;
                                      border:1px solid #e2e8f0;">
                          <tbody>%s</tbody>
                        </table>
                        %s
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                        <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
                          TBIBI — Clinique Virtuelle &bull; Cet email a été envoyé automatiquement.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body></html>
            """.formatted(accentColor, title, recipientName, intro, rowsHtml, cta);
    }
}
