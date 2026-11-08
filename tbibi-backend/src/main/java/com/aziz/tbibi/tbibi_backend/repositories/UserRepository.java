package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

// JpaRepository<User, Long> gives us built-in methods for free:
//   save(), findById(), findAll(), delete(), count(), existsById()...
// We only need to declare the EXTRA methods we want.
// Spring Data JPA generates the SQL automatically from the method name.
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // FIX: use IgnoreCase so "test@mail.com" and "TEST@MAIL.COM"
    // are treated as the same account — prevents duplicate registrations
    // SQL: SELECT * FROM users WHERE LOWER(email) = LOWER(?)
    Optional<User> findByEmailIgnoreCase(String email);

    // Used during registration to check if email is already taken
    // SQL: SELECT COUNT(*) > 0 FROM users WHERE email = ?
    Boolean existsByEmail(String email);

    // Used by admin panel to filter users by role
    // SQL: SELECT * FROM users WHERE role = ?
    List<User> findByRole(Role role);

    // Used by admin stats — faster than findByRole().size()
    // SQL: SELECT COUNT(*) FROM users WHERE role = ?
    long countByRole(Role role);
}
