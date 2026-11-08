package com.aziz.tbibi.tbibi_backend.repositories;

import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.entities.UserSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserSubscriptionRepository extends JpaRepository<UserSubscription, Long> {

    // Gets the ACTIVE subscription of a user
    // SQL: SELECT * FROM user_subscriptions WHERE user_id = ? AND status = ?
    Optional<UserSubscription> findByUserAndStatus(User user, String status);

    // Gets ALL subscriptions (past and present) for a user
    // Used during cascade delete — we must delete these before deleting the user
    // SQL: SELECT * FROM user_subscriptions WHERE user_id = ?
    List<UserSubscription> findByUser(User user);
}
