package com.parallaxcrm.shared.error;

/** No valid session, bad credentials, or the session's user is no longer active. */
public class UnauthenticatedException extends ParallaxException {

    public UnauthenticatedException(String message) {
        super(ErrorCode.UNAUTHENTICATED, message);
    }
}
