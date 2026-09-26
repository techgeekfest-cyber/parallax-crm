package com.parallaxcrm.identity.internal;

import com.parallaxcrm.shared.error.RateLimitedException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Locks an email address out for a while after repeated failed sign-ins, to stop password guessing. State is kept in
 * memory, which is correct for the single backend instance this project runs; multiple instances would need a
 * shared store.
 */
@Component
class LoginAttemptLimiter {

    private static final int MAX_TRACKED_EMAILS = 10_000;

    private final int maxFailures;
    private final Duration lockout;
    private final Clock clock;
    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    @Autowired
    LoginAttemptLimiter(@Value("${parallax.security.max-failed-logins}") int maxFailures,
            @Value("${parallax.security.login-lockout}") Duration lockout) {
        this(maxFailures, lockout, Clock.systemUTC());
    }

    LoginAttemptLimiter(int maxFailures, Duration lockout, Clock clock) {
        this.maxFailures = maxFailures;
        this.lockout = lockout;
        this.clock = clock;
    }

    void checkAllowed(String email) {
        Failures current = failures.get(email);
        Instant now = clock.instant();
        if (current != null && current.lockedUntil() != null && now.isBefore(current.lockedUntil())) {
            Duration remaining = Duration.between(now, current.lockedUntil());
            long minutes = Math.max(1, (remaining.toSeconds() + 59) / 60);
            throw new RateLimitedException(
                    "Too many failed sign-in attempts. Try again in %d minute%s.".formatted(minutes, minutes == 1 ? "" : "s"),
                    remaining);
        }
    }

    void recordFailure(String email) {
        Instant now = clock.instant();
        if (failures.size() > MAX_TRACKED_EMAILS) {
            failures.values().removeIf(entry -> entry.windowStart().plus(lockout).isBefore(now));
        }
        failures.compute(email, (key, previous) -> {
            boolean windowExpired = previous == null || previous.windowStart().plus(lockout).isBefore(now);
            int count = windowExpired ? 1 : previous.count() + 1;
            Instant windowStart = windowExpired ? now : previous.windowStart();
            return new Failures(count, windowStart, count >= maxFailures ? now.plus(lockout) : null);
        });
    }

    void reset(String email) {
        failures.remove(email);
    }

    private record Failures(int count, Instant windowStart, Instant lockedUntil) {
    }
}
