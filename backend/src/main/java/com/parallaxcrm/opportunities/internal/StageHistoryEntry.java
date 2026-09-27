package com.parallaxcrm.opportunities.internal;

import com.parallaxcrm.opportunities.OpportunityStage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** One immutable row per stage an opportunity entered, with the amount and probability at that moment. */
@Entity
@Table(name = "opportunity_stage_history")
public class StageHistoryEntry {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    private UUID id;

    @Column(name = "opportunity_id", nullable = false, updatable = false)
    private UUID opportunityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_stage", updatable = false)
    private OpportunityStage fromStage;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_stage", nullable = false, updatable = false)
    private OpportunityStage toStage;

    @Column(nullable = false, updatable = false)
    private BigDecimal amount;

    @Column(nullable = false, updatable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private int probability;

    @Column(name = "changed_by", updatable = false)
    private UUID changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected StageHistoryEntry() {
        // for JPA
    }

    public StageHistoryEntry(Opportunity opportunity, OpportunityStage fromStage, UUID changedBy) {
        this.opportunityId = opportunity.getId();
        this.fromStage = fromStage;
        this.toStage = opportunity.getStage();
        this.amount = opportunity.getAmount();
        this.probability = opportunity.getProbability();
        this.changedBy = changedBy;
        this.changedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public OpportunityStage getFromStage() {
        return fromStage;
    }

    public OpportunityStage getToStage() {
        return toStage;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public int getProbability() {
        return probability;
    }

    public UUID getChangedBy() {
        return changedBy;
    }

    public Instant getChangedAt() {
        return changedAt;
    }
}
