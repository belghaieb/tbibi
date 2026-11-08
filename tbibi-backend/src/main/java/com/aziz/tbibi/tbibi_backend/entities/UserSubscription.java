package com.aziz.tbibi.tbibi_backend.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_subscriptions")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    // @ManyToOne = many subscriptions can belong to one user
    // (a user can have a history of subscriptions over time)
    // @JoinColumn = creates column "user_id" pointing to users table
    private User user;

    @ManyToOne
    @JoinColumn(name = "subscription_id", nullable = false)
    // @ManyToOne = many user_subscriptions can point to the same plan
    // example: 100 users can all be on the BASIC plan
    private Subscription subscription;

    @Column(nullable = false)
    private LocalDateTime startsAt;
    // the date this subscription started

    private LocalDateTime endsAt;
    // the date this subscription ends
    // null means it never expires (lifetime plan)

    @Column(nullable = false)
    @Builder.Default
    private String status = "ACTIVE";
    // ACTIVE   = user is currently on this plan
    // EXPIRED  = plan has ended
    // CANCELED = user cancelled before it ended
}