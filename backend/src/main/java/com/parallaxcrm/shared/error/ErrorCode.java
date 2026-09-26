package com.parallaxcrm.shared.error;

/**
 * Stable, machine-readable error codes returned in every ProblemDetail response.
 * The frontend branches on these, never on message text.
 */
public enum ErrorCode {
    VALIDATION_FAILED,
    BAD_REQUEST,
    NOT_FOUND,
    RECORD_NOT_FOUND,
    DUPLICATE_RECORD,
    CONFLICT,
    DATA_INTEGRITY,
    UNAUTHENTICATED,
    PERMISSION_DENIED,
    CSRF_REJECTED,
    RATE_LIMITED,
    INTERNAL_ERROR
}
