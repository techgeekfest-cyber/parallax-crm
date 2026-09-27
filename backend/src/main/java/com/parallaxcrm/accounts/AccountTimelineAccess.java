package com.parallaxcrm.accounts;

import com.parallaxcrm.activities.ActivityTarget;
import com.parallaxcrm.activities.TimelineAccess;
import com.parallaxcrm.shared.error.InvalidRequestException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Accounts are shared reference data, so every signed-in user can read and add to an account's timeline. */
@Component
class AccountTimelineAccess implements TimelineAccess {

    private final AccountService accounts;

    AccountTimelineAccess(AccountService accounts) {
        this.accounts = accounts;
    }

    @Override
    public ActivityTarget target() {
        return ActivityTarget.ACCOUNT;
    }

    @Override
    public void requireCanView(UUID recordId) {
        accounts.get(recordId);
    }

    @Override
    public void requireCanLog(UUID recordId) {
        if (accounts.get(recordId).isArchived()) {
            throw new InvalidRequestException("Restore this account before adding activities to it.");
        }
    }
}
