package com.parallaxcrm.shared.web;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTests {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void uniqueConstraintViolationsBecomeDuplicateRecord() {
        // The race-condition path: two concurrent inserts both pass the service check, the index rejects one.
        var response = handler.handleDataIntegrity(violation("uq_leads_email"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().getProperties()).containsEntry("code", "DUPLICATE_RECORD");
    }

    @Test
    void otherConstraintViolationsBecomeDataIntegrity() {
        var response = handler.handleDataIntegrity(violation("ck_leads_status"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().getProperties()).containsEntry("code", "DATA_INTEGRITY");
    }

    @Test
    void unexpectedErrorsNeverLeakTheirMessage() {
        var response = handler.handleUnexpected(new IllegalStateException("connection string: secret"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().getDetail()).doesNotContain("secret");
        assertThat(response.getBody().getProperties()).containsEntry("code", "INTERNAL_ERROR");
    }

    private static DataIntegrityViolationException violation(String constraint) {
        return new DataIntegrityViolationException("could not execute statement",
                new ConstraintViolationException("violation", new SQLException(), constraint));
    }
}
