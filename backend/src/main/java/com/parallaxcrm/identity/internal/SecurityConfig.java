package com.parallaxcrm.identity.internal;

import com.parallaxcrm.shared.error.ErrorCode;
import com.parallaxcrm.shared.web.Problems;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;

/**
 * Session-based security for a same-origin SPA (ADR 0002): server-side sessions in PostgreSQL, a cookie-to-header
 * CSRF token, and JSON ProblemDetail responses for every authentication or authorisation failure.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

    static final String SESSION_COOKIE = "PARALLAX_SESSION";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, CookieCsrfTokenRepository csrfTokens,
            SecurityContextRepository securityContexts, JsonMapper json) throws Exception {
        http
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .csrf(csrf -> csrf.spa().csrfTokenRepository(csrfTokens))
                .securityContext(context -> context.securityContextRepository(securityContexts))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .logout(logout -> logout
                        .logoutUrl("/api/v1/auth/logout")
                        .deleteCookies(SESSION_COOKIE)
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpServletResponse.SC_NO_CONTENT)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, ex) -> write(response, json,
                                Problems.of(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Sign in to continue.")))
                        .accessDeniedHandler((request, response, ex) -> write(response, json, ex instanceof CsrfException
                                ? Problems.of(HttpStatus.FORBIDDEN, ErrorCode.CSRF_REJECTED,
                                        "Your security token has expired. Refresh the page and try again.")
                                : Problems.of(HttpStatus.FORBIDDEN, ErrorCode.PERMISSION_DENIED,
                                        "You don't have permission to do that."))));
        return http.build();
    }

    /** Session cookie: HttpOnly, SameSite=Lax, Secure outside plain-http local development. */
    @Bean
    CookieSerializer sessionCookieSerializer(@Value("${parallax.security.secure-cookies}") boolean secure) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName(SESSION_COOKIE);
        serializer.setCookiePath("/");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(secure);
        serializer.setSameSite("Lax");
        return serializer;
    }

    @Bean
    CookieCsrfTokenRepository csrfTokenRepository(@Value("${parallax.security.secure-cookies}") boolean secure) {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(cookie -> cookie.secure(secure).sameSite("Lax").path("/"));
        return repository;
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** Applied on sign-in, after any previous session has been invalidated: issue a new CSRF token. */
    @Bean
    SessionAuthenticationStrategy sessionAuthenticationStrategy(CookieCsrfTokenRepository csrfTokens) {
        return new CsrfAuthenticationStrategy(csrfTokens);
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    private static void write(HttpServletResponse response, JsonMapper json, ProblemDetail problem) throws IOException {
        response.setStatus(problem.getStatus());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        json.writeValue(response.getOutputStream(), Problems.toMap(problem));
    }
}
