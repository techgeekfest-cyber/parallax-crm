package com.parallaxcrm.shared.error;

/**
 * A request that is well-formed but violates a rule, optionally tied to a single field.
 */
public class InvalidRequestException extends ParallaxException {

    private final String field;

    public InvalidRequestException(String message) {
        this(null, message);
    }

    public InvalidRequestException(String field, String message) {
        super(field == null ? ErrorCode.BAD_REQUEST : ErrorCode.VALIDATION_FAILED, message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
