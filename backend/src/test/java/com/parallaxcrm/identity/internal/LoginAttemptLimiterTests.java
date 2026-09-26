package com.parallaxcrm.identity.internal;

import com.parallaxcrm.shared.error.RateLimitedException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginAttemptLimiterTests {

    private final MutableClock clock = new MutableClock();
    private final LoginAttemptLimiter limiter = new LoginAttemptLimiter(3, Duration.ofMinutes(15), clock);

    @Test
    void locksAfterTheLimitAndUnlocksWhenTheLockoutExpires() {
        failTimes(3);
        assertThatThrownBy(() -> limiter.checkAllowed("a@example.com"))
                .isInstanceOf(RateLimitedException.class)
                .hasMessageContaining("15 minutes");

        clock.advance(Duration.ofMinutes(15).plusSeconds(1));
        assertThatCode(() -> limiter.checkAllowed("a@example.com")).doesNotThrowAnyException();
    }

    @Test
    void successfulSignInClearsFailures() {
        failTimes(2);
        limiter.reset("a@example.com");
        failTimes(2);
        assertThatCode(() -> limiter.checkAllowed("a@example.com")).doesNotThrowAnyException();
    }

    @Test
    void failuresOutsideTheWindowDoNotAccumulate() {
        failTimes(2);
        clock.advance(Duration.ofMinutes(16));
        failTimes(2);
        assertThatCode(() -> limiter.checkAllowed("a@example.com")).doesNotThrowAnyException();
    }

    @Test
    void emailsAreTrackedIndependently() {
        failTimes(3);
        assertThatCode(() -> limiter.checkAllowed("b@example.com")).doesNotThrowAnyException();
    }

    private void failTimes(int times) {
        for (int i = 0; i < times; i++) {
            limiter.recordFailure("a@example.com");
        }
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T09:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
