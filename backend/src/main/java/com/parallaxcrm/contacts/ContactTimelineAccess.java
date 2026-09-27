package com.parallaxcrm.contacts;

import com.parallaxcrm.activities.ActivityTarget;
import com.parallaxcrm.activities.TimelineAccess;
import com.parallaxcrm.shared.error.InvalidRequestException;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Contacts are shared like accounts: every signed-in user can read and add to a contact's timeline. */
@Component
class ContactTimelineAccess implements TimelineAccess {

    private final ContactService contacts;

    ContactTimelineAccess(ContactService contacts) {
        this.contacts = contacts;
    }

    @Override
    public ActivityTarget target() {
        return ActivityTarget.CONTACT;
    }

    @Override
    public void requireCanView(UUID recordId) {
        contacts.get(recordId);
    }

    @Override
    public void requireCanLog(UUID recordId) {
        if (contacts.get(recordId).isArchived()) {
            throw new InvalidRequestException("Restore this contact before adding activities to it.");
        }
    }
}
