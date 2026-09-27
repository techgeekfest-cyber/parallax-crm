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
    /** A workflow action the record's current state doesn't allow, e.g. an invalid stage transition. */
    INVALID_STATE_TRANSITION,
    /** A second conversion of a lead that has already been converted. */
    ALREADY_CONVERTED,
    DATA_INTEGRITY,
    UNAUTHENTICATED,
    PERMISSION_DENIED,
    CSRF_REJECTED,
    RATE_LIMITED,
    INTERNAL_ERROR
}
