package com.aziz.tbibi.tbibi_backend.enums;

public enum VerificationStatus {
    PENDING,    // doctor just registered, waiting for review
    VERIFIED,   // admin approved the doctor
    REJECTED    // admin rejected the doctor
}