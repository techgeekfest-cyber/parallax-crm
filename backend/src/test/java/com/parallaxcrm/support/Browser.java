package com.parallaxcrm.support;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * A minimal cookie-keeping client, so tests exercise the real sign-in flow: session cookie, CSRF cookie-to-header,
 * session rotation and logout — nothing is faked with test-only authentication.
 */
public class Browser {

    public static final String SESSION_COOKIE = "PARALLAX_SESSION";
    public static final String CSRF_COOKIE = "XSRF-TOKEN";

    private final MockMvcTester mvc;
    private final Map<String, Cookie> cookies = new LinkedHashMap<>();

    public Browser(MockMvcTester mvc) {
        this.mvc = mvc;
    }

    public MvcTestResult get(String uri) {
        return send(mvc.get().uri(uri));
    }

    public MvcTestResult post(String uri, String json) {
        return send(mvc.post().uri(uri).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    public MvcTestResult put(String uri, String json) {
        return send(mvc.put().uri(uri).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    /** Like a browser SPA: fetch a CSRF token first if there is no cookie yet, then send it as a header. */
    public MvcTestResult write(Function<Browser, MvcTestResult> request) {
        if (!cookies.containsKey(CSRF_COOKIE)) {
            get("/api/v1/auth/csrf");
        }
        return request.apply(this);
    }

    public MvcTestResult login(String email, String password) {
        return write(browser -> browser.post("/api/v1/auth/login",
                "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)));
    }

    public MvcTestResult logout() {
        return write(browser -> browser.post("/api/v1/auth/logout", "{}"));
    }

    public String cookie(String name) {
        Cookie cookie = cookies.get(name);
        return cookie == null ? null : cookie.getValue();
    }

    public void forget(String name) {
        cookies.remove(name);
    }

    private MvcTestResult send(MockMvcTester.MockMvcRequestBuilder builder) {
        if (!cookies.isEmpty()) {
            builder.cookie(cookies.values().toArray(Cookie[]::new));
        }
        Cookie csrf = cookies.get(CSRF_COOKIE);
        if (csrf != null) {
            builder.header("X-XSRF-TOKEN", csrf.getValue());
        }
        MvcTestResult result = builder.exchange();
        for (Cookie cookie : result.getResponse().getCookies()) {
            if (cookie.getMaxAge() == 0 || cookie.getValue() == null || cookie.getValue().isEmpty()) {
                cookies.remove(cookie.getName());
            } else {
                cookies.put(cookie.getName(), cookie);
            }
        }
        return result;
    }
}
