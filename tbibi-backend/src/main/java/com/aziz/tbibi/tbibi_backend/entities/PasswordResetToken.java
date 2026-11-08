package com.aziz.tbibi.tbibi_backend.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "password_reset_tokens")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The random UUID token sent in the email link
    @Column(nullable = false, unique = true)
    private String token;

    // The user who requested the reset
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Token expires 15 minutes after creation
    @Column(nullable = false)
    private LocalDateTime expiresAt;

    // True after the token has been used (one-time use)
    @Column(nullable = false)
    private boolean used;
}
