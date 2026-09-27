package com.parallaxcrm.activities.web;

import com.parallaxcrm.activities.ActivityTarget;
import com.parallaxcrm.activities.ActivityType;
import com.parallaxcrm.activities.NewActivity;
import com.parallaxcrm.shared.error.InvalidRequestException;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/** Log a call, email, meeting or note. Give exactly one of the record ids. */
public record ActivityRequest(
        @NotNull @Schema(description = "CALL, EMAIL, MEETING or NOTE. Other types are written by workflows only.")
        ActivityType type,
        @NotBlank @Size(max = 255) String subject,
        @Size(max = 5000) String body,
        @Schema(description = "When it happened; defaults to now. Can't be in the future.")
        Instant occurredAt,
        UUID leadId,
        UUID accountId,
        UUID contactId,
        UUID opportunityId) {

    NewActivity toNewActivity() {
        TargetRef target = TargetRef.exactlyOne(leadId, accountId, contactId, opportunityId);
        return new NewActivity(type, subject, body, occurredAt, target.target(), target.id());
    }

    /** Resolves "exactly one of these ids" for both the request body and the list query. */
    record TargetRef(ActivityTarget target, UUID id) {

        static TargetRef exactlyOne(UUID leadId, UUID accountId, UUID contactId, UUID opportunityId) {
            TargetRef found = null;
            int count = 0;
            if (leadId != null) {
                found = new TargetRef(ActivityTarget.LEAD, leadId);
                count++;
            }
            if (accountId != null) {
                found = new TargetRef(ActivityTarget.ACCOUNT, accountId);
                count++;
            }
            if (contactId != null) {
                found = new TargetRef(ActivityTarget.CONTACT, contactId);
                count++;
            }
            if (opportunityId != null) {
                found = new TargetRef(ActivityTarget.OPPORTUNITY, opportunityId);
                count++;
            }
            if (count != 1) {
                throw new InvalidRequestException(
                        "Give exactly one of leadId, accountId, contactId or opportunityId.");
            }
            return found;
        }
    }
}
