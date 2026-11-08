package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.Subscription;
import com.aziz.tbibi.tbibi_backend.enums.SubscriptionCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {

    Optional<Subscription> findByCode(SubscriptionCode code);
    // generates: SELECT * FROM subscriptions WHERE code = ?
    // used during registration when user picks BASIC or PREMIUM
    // example: findByCode(SubscriptionCode.BASIC)
}