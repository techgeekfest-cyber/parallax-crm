package com.parallaxcrm.identity;

import com.parallaxcrm.identity.internal.User;
import com.parallaxcrm.identity.internal.UserRepository;
import com.parallaxcrm.shared.error.UnauthenticatedException;
import com.parallaxcrm.shared.security.Actors;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.UUID;

/**
 * Resolves the signed-in user. The session stores only the user's id; the user's current role and status are read
 * from the database once per request, so a role change or deactivation applies immediately.
 */
@Component
public class CurrentUser {

    private static final String CACHE_KEY = CurrentUser.class.getName();

    private final UserRepository users;

    CurrentUser(UserRepository users) {
        this.users = users;
    }

    public AuthenticatedUser require() {
        UUID id = Actors.currentActorId()
                .orElseThrow(() -> new UnauthenticatedException("Sign in to continue."));

        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request != null && request.getAttribute(CACHE_KEY, RequestAttributes.SCOPE_REQUEST)
                instanceof AuthenticatedUser cached && cached.id().equals(id)) {
            return cached;
        }

        AuthenticatedUser user = users.findById(id)
                .filter(User::isActive)
                .map(User::toAuthenticatedUser)
                .orElseThrow(() -> new UnauthenticatedException("Your session has ended. Sign in again."));
        if (request != null) {
            request.setAttribute(CACHE_KEY, user, RequestAttributes.SCOPE_REQUEST);
        }
        return user;
    }
}
