package com.parallaxcrm.activities.internal;

import com.parallaxcrm.activities.ActivityLinks;
import com.parallaxcrm.activities.ActivityType;
import com.parallaxcrm.shared.error.InvalidRequestException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/** One entry on a record's timeline. Activities are append-only: the application never edits or deletes them. */
@Entity
@Table(name = "activities")
public class Activity {

    static final int MAX_SUBJECT = 255;
    static final int MAX_BODY = 5000;

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private ActivityType type;

    @Column(nullable = false, updatable = false)
    private String subject;

    @Column(updatable = false)
    private String body;

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(name = "lead_id", updatable = false)
    private UUID leadId;

    @Column(name = "account_id", updatable = false)
    private UUID accountId;

    @Column(name = "contact_id", updatable = false)
    private UUID contactId;

    @Column(name = "opportunity_id", updatable = false)
    private UUID opportunityId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Activity() {
        // for JPA
    }

    public Activity(ActivityType type, String subject, String body, UUID actorId, Instant occurredAt,
            ActivityLinks links) {
        if (type == null) {
            throw new InvalidRequestException("type", "Choose an activity type.");
        }
        if (subject == null || subject.isBlank()) {
            throw new InvalidRequestException("subject", "This field is required.");
        }
        this.type = type;
        this.subject = truncate(subject.strip(), MAX_SUBJECT);
        this.body = body == null || body.isBlank() ? null : truncate(body.strip(), MAX_BODY);
        this.actorId = actorId;
        this.createdAt = Instant.now();
        this.occurredAt = occurredAt != null ? occurredAt : createdAt;
        this.leadId = links.leadId();
        this.accountId = links.accountId();
        this.contactId = links.contactId();
        this.opportunityId = links.opportunityId();
    }

    /** System subjects embed record names; they are shortened rather than failing the workflow that wrote them. */
    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }

    public UUID getId() {
        return id;
    }

    public ActivityType getType() {
        return type;
    }

    public String getSubject() {
        return subject;
    }

    public String getBody() {
        return body;
    }

    public UUID getActorId() {
        return actorId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public UUID getLeadId() {
        return leadId;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public UUID getContactId() {
        return contactId;
    }

    public UUID getOpportunityId() {
        return opportunityId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
