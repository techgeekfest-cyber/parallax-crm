package com.parallaxcrm.shared.web;

import com.parallaxcrm.shared.error.ErrorCode;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Builds the ProblemDetail shape used by every error response, including those written by security filters. */
public final class Problems {

    private Problems() {
    }

    public static ProblemDetail of(HttpStatus status, ErrorCode code, String detail) {
        return decorate(ProblemDetail.forStatusAndDetail(status, detail), code);
    }

    public static ProblemDetail withFieldErrors(ProblemDetail problem, List<FieldError> fieldErrors) {
        problem.setProperty("fieldErrors", fieldErrors);
        return problem;
    }

    static ProblemDetail decorate(ProblemDetail problem, ErrorCode code) {
        problem.setProperty("code", code.name());
        String requestId = MDC.get(RequestIdFilter.MDC_KEY);
        if (requestId != null) {
            problem.setProperty("requestId", requestId);
        }
        return problem;
    }

    /** Flattened JSON shape, for code paths (such as security filters) that write responses without Spring MVC. */
    public static Map<String, Object> toMap(ProblemDetail problem) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", problem.getType() == null ? "about:blank" : problem.getType().toString());
        HttpStatus status = HttpStatus.resolve(problem.getStatus());
        body.put("title", problem.getTitle() != null ? problem.getTitle()
                : status != null ? status.getReasonPhrase() : null);
        body.put("status", problem.getStatus());
        body.put("detail", problem.getDetail());
        if (problem.getProperties() != null) {
            body.putAll(problem.getProperties());
        }
        return body;
    }

    public static HttpStatus statusFor(ErrorCode code) {
        return switch (code) {
            case VALIDATION_FAILED, BAD_REQUEST -> HttpStatus.BAD_REQUEST;
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case PERMISSION_DENIED, CSRF_REJECTED -> HttpStatus.FORBIDDEN;
            case NOT_FOUND, RECORD_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case DUPLICATE_RECORD, CONFLICT, INVALID_STATE_TRANSITION, ALREADY_CONVERTED, DATA_INTEGRITY -> HttpStatus.CONFLICT;
            case RATE_LIMITED -> HttpStatus.TOO_MANY_REQUESTS;
            case INTERNAL_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
