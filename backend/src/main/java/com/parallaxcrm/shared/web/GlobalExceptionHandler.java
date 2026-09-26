package com.parallaxcrm.shared.web;

import com.parallaxcrm.shared.error.DuplicateRecordException;
import com.parallaxcrm.shared.error.ErrorCode;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.ParallaxException;
import org.hibernate.exception.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
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
        HttpStatus status = statusFor(ex.getCode());
        ProblemDetail problem = problem(status, ex.getCode(), ex.getMessage());
        String field = switch (ex) {
            case DuplicateRecordException duplicate -> duplicate.getField();
            case InvalidRequestException invalid -> invalid.getField();
            default -> null;
        };
        if (field != null) {
            problem.setProperty("fieldErrors", List.of(new FieldError(field, ex.getMessage())));
        }
        return ResponseEntity.status(status).body(problem);
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
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                "Some fields are missing or invalid.");
        problem.setProperty("fieldErrors", ex.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
                .toList());
        return ResponseEntity.badRequest().body(problem);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.badRequest().body(problem(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST,
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
            decorate(problem, code);
        }
        return response;
    }

    private static ResponseEntity<ProblemDetail> respond(HttpStatus status, ErrorCode code, String detail) {
        return ResponseEntity.status(status).body(problem(status, code, detail));
    }

    private static ProblemDetail problem(HttpStatus status, ErrorCode code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        return decorate(problem, code);
    }

    private static ProblemDetail decorate(ProblemDetail problem, ErrorCode code) {
        problem.setProperty("code", code.name());
        String requestId = MDC.get(RequestIdFilter.MDC_KEY);
        if (requestId != null) {
            problem.setProperty("requestId", requestId);
        }
        return problem;
    }

    private static HttpStatus statusFor(ErrorCode code) {
        return switch (code) {
            case VALIDATION_FAILED, BAD_REQUEST -> HttpStatus.BAD_REQUEST;
            case NOT_FOUND, RECORD_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case DUPLICATE_RECORD, CONFLICT, DATA_INTEGRITY -> HttpStatus.CONFLICT;
            case PERMISSION_DENIED -> HttpStatus.FORBIDDEN;
            case INTERNAL_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
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
