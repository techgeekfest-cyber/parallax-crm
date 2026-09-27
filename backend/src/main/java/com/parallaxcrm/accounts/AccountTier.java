package com.parallaxcrm.accounts;

/** Segmentation used to prioritise accounts. Each account type derives its tier from its own data. */
public enum AccountTier {
    /** Enterprise: very large revenue or global headcount. */
    STRATEGIC,
    /** Enterprise below the strategic threshold. */
    MAJOR,
    /** SMB trading for five years or more. */
    ESTABLISHED,
    /** Younger SMB. */
    EMERGING,
    /** Startup: bootstrapped, pre-seed or seed. */
    EARLY_STAGE,
    /** Startup: Series A or B. */
    GROWTH_STAGE,
    /** Startup: Series C and later. */
    LATE_STAGE
}
