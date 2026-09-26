package com.parallaxcrm.identity.internal;

import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Ends a user's server-side sessions. Sessions are indexed by principal name, which is the user's id, so this works
 * across every browser the user is signed in on.
 */
@Component
class SessionRevoker {

    private final FindByIndexNameSessionRepository<? extends Session> sessions;

    SessionRevoker(FindByIndexNameSessionRepository<? extends Session> sessions) {
        this.sessions = sessions;
    }

    void revokeAll(UUID userId) {
        revokeAllExcept(userId, null);
    }

    void revokeAllExcept(UUID userId, String keepSessionId) {
        sessions.findByPrincipalName(userId.toString()).keySet().stream()
                .filter(sessionId -> !sessionId.equals(keepSessionId))
                .forEach(sessions::deleteById);
    }
}
