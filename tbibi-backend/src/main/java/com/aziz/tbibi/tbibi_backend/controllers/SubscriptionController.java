package com.aziz.tbibi.tbibi_backend.controllers;
import com.aziz.tbibi.tbibi_backend.dto.CheckoutRequest;
import com.aziz.tbibi.tbibi_backend.entities.Subscription;
import com.aziz.tbibi.tbibi_backend.entities.User;
import com.aziz.tbibi.tbibi_backend.entities.UserSubscription;
import com.aziz.tbibi.tbibi_backend.enums.SubscriptionCode;
import com.aziz.tbibi.tbibi_backend.repositories.SubscriptionRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserRepository;
import com.aziz.tbibi.tbibi_backend.repositories.UserSubscriptionRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;


@RestController
@RequestMapping("/api/subscriptions")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;

    @Value("${stripe.secret.key}")
    private String stripeSecretKey;

    @Value("${stripe.success.url}")
    private String successUrl;

    @Value("${stripe.cancel.url}")
    private String cancelUrl;

    // GET /api/subscriptions — returns all active plans
    @GetMapping
    public ResponseEntity<List<Subscription>> getAllSubscriptions() {
        return ResponseEntity.ok(subscriptionRepository.findAll());
    }

    @PostMapping("/checkout-session")
    public ResponseEntity<?> createCheckoutSession(
            @RequestParam Long userId,
            @RequestBody CheckoutRequest request) {

        // =====================================================================
        // DEMO MODE — Stripe bypassed
        // To re-enable real Stripe payments:
        //   1. Remove this block (lines between the DEMO MODE comments)
        //   2. Uncomment the Stripe block below
        // =====================================================================
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "User not found"));
        }

        SubscriptionCode code;
        try {
            code = SubscriptionCode.valueOf(request.getPlanCode().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid plan code"));
        }

        Subscription plan = subscriptionRepository.findByCode(code).orElse(null);
        if (plan == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Plan not found"));
        }

        // Expire any existing ACTIVE subscription for this user
        Optional<UserSubscription> existing = userSubscriptionRepository.findByUserAndStatus(user, "ACTIVE");
        existing.ifPresent(sub -> {
            sub.setStatus("EXPIRED");
            userSubscriptionRepository.save(sub);
        });

        // Create a new ACTIVE subscription
        UserSubscription newSub = UserSubscription.builder()
                .user(user)
                .subscription(plan)
                .startsAt(LocalDateTime.now())
                .endsAt(null)   // null = no expiry for demo
                .status("ACTIVE")
                .build();
        userSubscriptionRepository.save(newSub);

        return ResponseEntity.ok(Map.of("checkoutUrl", "main.html"));
        // =====================================================================
        // END DEMO MODE
        // =====================================================================

        // =====================================================================
        // REAL STRIPE PAYMENT (re-enable when ready for production)
        // =====================================================================
        /*
        Stripe.apiKey = stripeSecretKey;

        try {
            long amount = request.getPlanCode().equalsIgnoreCase("BASIC")
                    ? 6000L
                    : 9000L;

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .addLineItem(
                            SessionCreateParams.LineItem.builder()
                                    .setQuantity(1L)
                                    .setPriceData(
                                            SessionCreateParams.LineItem.PriceData.builder()
                                                    .setCurrency("usd")
                                                    .setUnitAmount(amount)
                                                    .setProductData(
                                                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                    .setName("Tbibi " + request.getPlanCode() + " Plan")
                                                                    .build()
                                                    )
                                                    .build()
                                    )
                                    .build()
                    )
                    .build();

            Session session = Session.create(params);

            return ResponseEntity.ok(Map.of("checkoutUrl", session.getUrl()));

        } catch (StripeException e) {
            return ResponseEntity
                    .status(500)
                    .body(Map.of("message", e.getMessage()));
        }
        */
    }
}