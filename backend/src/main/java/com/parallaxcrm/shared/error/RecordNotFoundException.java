package com.parallaxcrm.shared.error;

public class RecordNotFoundException extends ParallaxException {

    public RecordNotFoundException(String recordType, Object id) {
        super(ErrorCode.RECORD_NOT_FOUND, "%s %s was not found.".formatted(recordType, id));
    }
}
