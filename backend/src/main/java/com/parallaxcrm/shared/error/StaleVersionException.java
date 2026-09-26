package com.parallaxcrm.shared.error;

/**
 * The client edited an older version of the record than the one stored. The client must reload and re-apply its
 * change, so nobody's edit is silently overwritten.
 */
public class StaleVersionException extends ParallaxException {

    public StaleVersionException(String recordType) {
        super(ErrorCode.CONFLICT,
                "This %s was changed by someone else. Reload it to see the latest version, then try again."
                        .formatted(recordType));
    }
}
