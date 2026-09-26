package com.parallaxcrm.audit.internal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/** One immutable row in the audit log. Never updated or deleted by the application. */
@Entity
@Table(name = "audit_events")
public class AuditEvent {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "entity_type", nullable = false, updatable = false)
    private String entityType;

    @Column(name = "entity_id", nullable = false, updatable = false)
    private UUID entityId;

    @Column(nullable = false, updatable = false)
    private String action;

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(nullable = false, updatable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private String changes;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected AuditEvent() {
    }

    public AuditEvent(String entityType, UUID entityId, String action, UUID actorId, String changesJson) {
        this.entityType = entityType;
        this.entityId = entityId;
        this.action = action;
        this.actorId = actorId;
        this.changes = changesJson;
        this.occurredAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public String getAction() {
        return action;
    }

    public UUID getActorId() {
        return actorId;
    }

    public String getChanges() {
        return changes;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
