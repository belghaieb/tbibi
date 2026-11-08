package com.aziz.tbibi.tbibi_backend.controllers;

import com.aziz.tbibi.tbibi_backend.dto.AccountResponse;
import com.aziz.tbibi.tbibi_backend.services.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
// Map = a key-value structure
// we use it to receive the password update request
// example: {"currentPassword": "old", "newPassword": "new"}

@RestController
@RequestMapping("/api/account")
// all endpoints start with /api/account
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @GetMapping("/me")
    // handles GET requests to /api/account/me
    // frontend calls this to load the profile page
    public ResponseEntity<AccountResponse> getAccount(
            @RequestParam Long userId) {
        // @RequestParam = reads a parameter from the URL
        // example: /api/account/me?userId=1

        AccountResponse response =
                accountService.getAccount(userId);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/me")
    // handles PUT requests to /api/account/me
    // frontend calls this when user saves profile changes
    public ResponseEntity<AccountResponse> updateAccount(
            @RequestParam Long userId,
            @RequestBody AccountResponse request) {
        // @RequestBody = reads the JSON sent by frontend
        // contains the updated profile fields

        AccountResponse response =
                accountService.updateAccount(userId, request);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/password")
    // handles PUT requests to /api/account/password
    // frontend calls this when user changes their password
    public ResponseEntity<String> updatePassword(
            @RequestParam Long userId,
            @RequestBody Map<String, String> request) {
        // Map<String, String> receives:
        // {
        //   "currentPassword": "oldpass123",
        //   "newPassword": "newpass456"
        // }

        accountService.updatePassword(
                userId,
                request.get("currentPassword"),
                // get() = retrieves value by key from the Map
                request.get("newPassword"));

        return ResponseEntity.ok(
                "Password updated successfully");
    }
}