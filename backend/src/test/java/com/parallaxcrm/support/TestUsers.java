package com.parallaxcrm.support;

import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.identity.internal.User;
import com.parallaxcrm.identity.internal.UserRepository;
import jakarta.servlet.http.Cookie;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

/** Creates real, persisted users and authenticates requests as them. */
public class TestUsers {

    public static final String PASSWORD = "correct horse battery";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    TestUsers(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public AuthenticatedUser create(Role role) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        return create(role, role.name().toLowerCase().replace('_', '.') + "." + suffix + "@test.example", "Test", suffix);
    }

    public AuthenticatedUser create(Role role, String email, String firstName, String lastName) {
        User user = User.create(email, firstName, lastName, role, passwordEncoder.encode(PASSWORD));
        return users.saveAndFlush(user).toAuthenticatedUser();
    }

    /**
     * Authenticates a MockMvc request the way a real session would (principal name = user id) and attaches a genuine
     * cookie + header CSRF pair, so the production CSRF filter validates it unmodified.
     */
    public static RequestPostProcessor as(AuthenticatedUser user) {
        var token = UsernamePasswordAuthenticationToken.authenticated(user.id().toString(), null,
                List.of(new SimpleGrantedAuthority(user.role().authority())));
        RequestPostProcessor auth = authentication(token);
        return request -> {
            String csrf = UUID.randomUUID().toString();
            request.setCookies(new Cookie(Browser.CSRF_COOKIE, csrf));
            request.addHeader("X-XSRF-TOKEN", csrf);
            return auth.postProcessRequest(request);
        };
    }
}
