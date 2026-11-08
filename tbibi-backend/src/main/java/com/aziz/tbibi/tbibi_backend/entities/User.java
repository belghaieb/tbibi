package com.aziz.tbibi.tbibi_backend.entities;

import com.aziz.tbibi.tbibi_backend.enums.Role;
import jakarta.persistence.*;
// @Entity        = tells Spring this class is a database table
// @Table         = lets us give a name to the table in MySQL
// @Id            = this field is the primary key (unique row identifier)
// @GeneratedValue = MySQL generates the ID automatically
// @Column        = customizes a column (name, unique, nullable...)
// @Enumerated    = tells JPA to store enum as text ("PATIENT") not a number
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
// @Data             = Lombok auto-generates getters and setters for all fields
// @Builder          = lets us create objects like: User.builder().email("x").build()
// @AllArgsConstructor = generates a constructor with all fields
// @NoArgsConstructor  = generates an empty constructor (required by JPA)

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    // nullable = false means this field is REQUIRED, cannot be empty
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(unique = true, nullable = false)
    // unique = true means no two users can have the same email
    private String email;

    @Column(nullable = false)
    private String password;
    // will store HASHED password, never plain text

    private String phone;

    private String avatarUrl;
    // stores the HTTP URL of the profile photo
    // example: "http://localhost:8084/uploads/avatars/user_1.jpg"
    // null until user uploads a photo

    @Enumerated(EnumType.STRING)
    // EnumType.STRING = saves "PATIENT" or "DOCTOR" as text in MySQL
    // not as a number (0 or 1) which would be confusing
    @Column(nullable = false)
    private Role role;

    @Column(updatable = false)
    // updatable = false means this date is written ONCE and never changed
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    // @PrePersist = this method runs automatically BEFORE saving to MySQL
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    // @PreUpdate = this method runs automatically BEFORE updating in MySQL
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}