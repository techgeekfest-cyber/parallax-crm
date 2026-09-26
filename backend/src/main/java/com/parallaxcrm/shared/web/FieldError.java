package com.parallaxcrm.shared.web;

/** A single field-level validation message inside a ProblemDetail's {@code fieldErrors}. */
public record FieldError(String field, String message) {
}
