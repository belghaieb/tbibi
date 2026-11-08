package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.PasswordResetToken;
import com.aziz.tbibi.tbibi_backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(String token);

    // Delete all previous tokens for a user before issuing a new one
    void deleteByUser(User user);
}
