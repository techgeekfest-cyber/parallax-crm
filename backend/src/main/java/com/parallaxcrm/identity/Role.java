package com.parallaxcrm.identity;

public enum Role {
    /** Manages users and sees everything. */
    ADMIN,
    /** Sees and manages the sales organisation's records; assigns work to reps. */
    SALES_MANAGER,
    /** Works their own leads and deals. */
    SALES_REP;

    public String authority() {
        return "ROLE_" + name();
    }
}
