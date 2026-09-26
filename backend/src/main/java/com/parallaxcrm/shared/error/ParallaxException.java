package com.parallaxcrm.shared.error;

/**
 * Root of all expected business errors. Each subtype carries an {@link ErrorCode} and a message
 * that is safe to show to end users.
 */
public abstract class ParallaxException extends RuntimeException {

    private final ErrorCode code;

    protected ParallaxException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public ErrorCode getCode() {
        return code;
    }
}
