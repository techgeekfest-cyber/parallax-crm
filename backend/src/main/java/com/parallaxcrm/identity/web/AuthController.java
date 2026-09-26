package com.parallaxcrm.identity.web;

import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.internal.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
class AuthController {

    private final AuthService auth;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final SessionAuthenticationStrategy sessionStrategy;
    private final SecurityContextRepository securityContexts;
    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();

    AuthController(AuthService auth, CurrentUser currentUser, AccessPolicy accessPolicy,
            SessionAuthenticationStrategy sessionStrategy, SecurityContextRepository securityContexts) {
        this.auth = auth;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.sessionStrategy = sessionStrategy;
        this.securityContexts = securityContexts;
    }

    @GetMapping("/csrf")
    @Operation(summary = "Issue a CSRF token",
            description = "Sets the XSRF-TOKEN cookie. Send its value in the X-XSRF-TOKEN header on every write request.")
    ResponseEntity<Void> csrf(@Parameter(hidden = true) CsrfToken token) {
        token.getToken(); // loading the deferred token writes the cookie
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    @Operation(summary = "Sign in", description = "Starts a server-side session (PARALLAX_SESSION cookie).")
    MeResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthenticatedUser user = auth.login(request.email(), request.password());

        // The session stores only the user's id (as the principal name) and role; everything else is re-read per
        // request. Only JDK and Spring types are serialized into the session, so deploys never break sessions.
        var authentication = UsernamePasswordAuthenticationToken.authenticated(user.id().toString(), null,
                List.of(new SimpleGrantedAuthority(user.role().authority())));
        // Always start from a brand-new session: this defeats session fixation, and nothing from a previous session
        // in this browser (possibly another user's) carries over.
        HttpSession previous = httpRequest.getSession(false);
        if (previous != null) {
            previous.invalidate();
        }
        sessionStrategy.onAuthentication(authentication, httpRequest, httpResponse);
        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        contextHolder.setContext(context);
        securityContexts.saveContext(context, httpRequest, httpResponse);

        return MeResponse.of(user, accessPolicy);
    }

    @GetMapping("/me")
    @Operation(summary = "The signed-in user and their permissions")
    MeResponse me() {
        return MeResponse.of(currentUser.require(), accessPolicy);
    }

    @PutMapping("/password")
    @Operation(summary = "Change your password", description = "Signs you out of every other session.")
    ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpRequest) {
        var session = httpRequest.getSession(false);
        auth.changePassword(currentUser.require(), request.currentPassword(), request.newPassword(),
                session == null ? null : session.getId());
        return ResponseEntity.noContent().build();
    }
}
