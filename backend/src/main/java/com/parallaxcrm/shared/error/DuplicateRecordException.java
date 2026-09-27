package com.parallaxcrm.shared.error;

public class DuplicateRecordException extends ParallaxException {

    private final String field;

    public DuplicateRecordException(String recordType, String field, String value) {
        super(ErrorCode.DUPLICATE_RECORD, "%s %s with %s '%s' already exists."
                .formatted("aeiou".indexOf(recordType.charAt(0)) >= 0 ? "An" : "A", recordType, field, value));
        this.field = field;
    }

    private DuplicateRecordException(String message, String field) {
        super(ErrorCode.DUPLICATE_RECORD, message);
        this.field = field;
    }

    /** The same error for a field nested under {@code prefix}, e.g. {@code email} → {@code contact.email}. */
    public DuplicateRecordException nestedUnder(String prefix) {
        return new DuplicateRecordException(getMessage(), prefix + "." + field);
    }

    public String getField() {
        return field;
    }
}
