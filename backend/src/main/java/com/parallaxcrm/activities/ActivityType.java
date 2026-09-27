package com.parallaxcrm.activities;

public enum ActivityType {
    CALL(true),
    EMAIL(true),
    MEETING(true),
    NOTE(true),
    STAGE_CHANGE(false),
    LEAD_CONVERSION(false),
    ASSIGNMENT(false),
    RECORD_UPDATE(false);

    private final boolean manual;

    ActivityType(boolean manual) {
        this.manual = manual;
    }

    /** Whether people log this type by hand; the others are only ever written by the workflow that caused them. */
    public boolean isManual() {
        return manual;
    }
}
