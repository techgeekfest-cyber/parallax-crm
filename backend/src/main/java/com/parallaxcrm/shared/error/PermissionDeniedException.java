package com.parallaxcrm.shared.error;

/** The current user is authenticated but not allowed to perform this action on this record. */
public class PermissionDeniedException extends ParallaxException {

    public PermissionDeniedException(String message) {
        super(ErrorCode.PERMISSION_DENIED, message);
    }
}
