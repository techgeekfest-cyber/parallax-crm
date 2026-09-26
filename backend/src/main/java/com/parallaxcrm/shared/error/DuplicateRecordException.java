package com.parallaxcrm.shared.error;

public class DuplicateRecordException extends ParallaxException {

    private final String field;

    public DuplicateRecordException(String recordType, String field, String value) {
        super(ErrorCode.DUPLICATE_RECORD, "A %s with %s '%s' already exists.".formatted(recordType, field, value));
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
