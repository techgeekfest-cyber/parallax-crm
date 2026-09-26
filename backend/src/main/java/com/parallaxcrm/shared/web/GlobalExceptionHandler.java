package com.parallaxcrm.shared.web;

import com.parallaxcrm.shared.error.DuplicateRecordException;
import com.parallaxcrm.shared.error.ErrorCode;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.ParallaxException;
import com.parallaxcrm.shared.error.RateLimitedException;
import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.List;

/**
 * Translates every exception into an RFC 7807 {@link ProblemDetail} with a stable {@code code},
 * the {@code requestId}, and {@code fieldErrors} where relevant. Stack traces and internal messages
 * never reach the client.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ParallaxException.class)
    ResponseEntity<ProblemDetail> handleParallax(ParallaxException ex) {
        HttpStatus status = Problems.statusFor(ex.getCode());
        ProblemDetail problem = Problems.of(status, ex.getCode(), ex.getMessage());
        String field = switch (ex) {
            case DuplicateRecordException duplicate -> duplicate.getField();
            case InvalidRequestException invalid -> invalid.getField();
            default -> null;
        };
        if (field != null) {
            Problems.withFieldErrors(problem, List.of(new FieldError(field, ex.getMessage())));
        }
        var response = ResponseEntity.status(status);
        if (ex instanceof RateLimitedException limited) {
            response.header(HttpHeaders.RETRY_AFTER, String.valueOf(limited.getRetryAfter().toSeconds()));
        }
        return response.body(problem);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex) {
        return respond(HttpStatus.FORBIDDEN, ErrorCode.PERMISSION_DENIED, "You don't have permission to do that.");
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ProblemDetail> handleAuthentication(AuthenticationException ex) {
        return respond(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Sign in to continue.");
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ProblemDetail> handleOptimisticLock(OptimisticLockingFailureException ex) {
        return respond(HttpStatus.CONFLICT, ErrorCode.CONFLICT,
                "This record was changed by someone else. Reload it to see the latest version, then try again.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> handleDataIntegrity(DataIntegrityViolationException ex) {
        String constraint = constraintName(ex);
        if (constraint != null && constraint.startsWith("uq_")) {
            return respond(HttpStatus.CONFLICT, ErrorCode.DUPLICATE_RECORD,
                    "A record with the same unique value already exists.");
        }
        log.warn("Data integrity violation (constraint={})", constraint, ex);
        return respond(HttpStatus.CONFLICT, ErrorCode.DATA_INTEGRITY,
                "The change conflicts with existing data and was not saved.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR,
                "Something went wrong on our side. If it keeps happening, report the request ID.");
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = Problems.withFieldErrors(
                Problems.of(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Some fields are missing or invalid."),
                ex.getBindingResult().getFieldErrors().stream()
                        .map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
                        .toList());
        return ResponseEntity.badRequest().body(problem);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.badRequest().body(Problems.of(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST,
                "The request body is not valid JSON or contains a value of the wrong type."));
    }

    /** Decorates framework-generated problems (405, 415, type mismatches, unknown routes …) with our properties. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
            HttpStatusCode statusCode, WebRequest request) {
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response != null && response.getBody() instanceof ProblemDetail problem
                && problem.getProperties() == null) {
            ErrorCode code = statusCode.value() == 404 ? ErrorCode.NOT_FOUND
                    : statusCode.is4xxClientError() ? ErrorCode.BAD_REQUEST
                    : ErrorCode.INTERNAL_ERROR;
            Problems.decorate(problem, code);
        }
        return response;
    }

    private static ResponseEntity<ProblemDetail> respond(HttpStatus status, ErrorCode code, String detail) {
        return ResponseEntity.status(status).body(Problems.of(status, code, detail));
    }

    private static String constraintName(Throwable ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation && violation.getConstraintName() != null) {
                return violation.getConstraintName().toLowerCase();
            }
        }
        return null;
    }
}
