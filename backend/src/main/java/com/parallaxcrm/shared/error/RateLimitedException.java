package com.parallaxcrm.shared.error;

import java.time.Duration;

public class RateLimitedException extends ParallaxException {

    private final Duration retryAfter;

    public RateLimitedException(String message, Duration retryAfter) {
        super(ErrorCode.RATE_LIMITED, message);
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
