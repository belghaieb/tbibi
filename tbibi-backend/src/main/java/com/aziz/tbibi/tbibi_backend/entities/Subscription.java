package com.aziz.tbibi.tbibi_backend.entities;

import com.aziz.tbibi.tbibi_backend.enums.SubscriptionCode;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "subscriptions")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(unique = true, nullable = false)
    // unique = true means only ONE row can have BASIC and ONE row can have PREMIUM
    // this table will only have 2 rows total
    private SubscriptionCode code;

    @Column(nullable = false)
    private String label;
    // example: "Plan Basique" or "Plan Premium"

    @Column(nullable = false)
    private Double price;
    // example: 0.0 for BASIC, 29.99 for PREMIUM

    @Builder.Default
    private Boolean active = true;
    // active = true means this plan is currently available
    // active = false means this plan is hidden from users
}