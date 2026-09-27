package com.parallaxcrm.opportunities.internal;

import com.parallaxcrm.opportunities.OpportunityInput;
import com.parallaxcrm.opportunities.OpportunityStage;
import com.parallaxcrm.opportunities.OpportunityType;
import com.parallaxcrm.shared.domain.AbstractEntity;
import com.parallaxcrm.shared.domain.LeadSource;
import com.parallaxcrm.shared.error.InvalidRequestException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.hibernate.annotations.Generated;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "opportunities")
public class Opportunity extends AbstractEntity {

    @Generated
    @Column(insertable = false, updatable = false)
    private String number;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OpportunityStage stage;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private int probability;

    @Column(name = "close_date", nullable = false)
    private LocalDate closeDate;

    @Enumerated(EnumType.STRING)
    private OpportunityType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "lead_source")
    private LeadSource leadSource;

    private String description;

    @Column(name = "next_step")
    private String nextStep;

    @Column(name = "owner_id")
    private UUID ownerId;

    /** Set exactly when the stage is closed (a database CHECK enforces this). */
    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Opportunity() {
        // for JPA
    }

    public static Opportunity create(OpportunityInput input, UUID ownerId) {
        Opportunity opportunity = new Opportunity();
        opportunity.update(input, ownerId);
        return opportunity;
    }

    public void update(OpportunityInput input, UUID ownerId) {
        if (input.accountId() == null) {
            throw new InvalidRequestException("accountId", "Choose an account.");
        }
        this.accountId = input.accountId();
        this.name = required("name", input.name());
        this.amount = amount(input.amount());
        this.closeDate = requiredValue("closeDate", input.closeDate());
        this.type = input.type();
        this.leadSource = input.leadSource();
        this.description = optional(input.description());
        this.nextStep = optional(input.nextStep());
        this.ownerId = ownerId;
        moveTo(requiredValue("stage", input.stage()), input.probability());
    }

    /**
     * Applies the stage and its probability. Closed stages force 100% (won) or 0% (lost) and stamp the closing time;
     * reopening clears it.
     */
    private void moveTo(OpportunityStage next, Integer requestedProbability) {
        if (next.isClosed()) {
            probability = next.defaultProbability();
            if (stage != next || closedAt == null) {
                closedAt = Instant.now();
            }
        } else {
            if (requestedProbability != null && (requestedProbability < 0 || requestedProbability > 100)) {
                throw new InvalidRequestException("probability", "Probability must be between 0 and 100.");
            }
            probability = requestedProbability != null ? requestedProbability : next.defaultProbability();
            closedAt = null;
        }
        stage = next;
    }

    /** Amount × probability: what the deal is worth to the forecast today. */
    public BigDecimal weightedAmount() {
        return amount.multiply(BigDecimal.valueOf(probability)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    public void archive() {
        if (archivedAt != null) {
            throw new InvalidRequestException("This opportunity is already archived.");
        }
        archivedAt = Instant.now();
    }

    public void restore() {
        if (archivedAt == null) {
            throw new InvalidRequestException("This opportunity isn't archived.");
        }
        archivedAt = null;
    }

    public boolean isArchived() {
        return archivedAt != null;
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("accountId", accountId);
        values.put("name", name);
        values.put("amount", amount);
        values.put("stage", stage);
        values.put("probability", probability);
        values.put("closeDate", closeDate == null ? null : closeDate.toString());
        values.put("type", type);
        values.put("leadSource", leadSource);
        values.put("description", description);
        values.put("nextStep", nextStep);
        values.put("ownerId", ownerId);
        return values;
    }

    public String getNumber() {
        return number;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public String getName() {
        return name;
    }

    public OpportunityStage getStage() {
        return stage;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public int getProbability() {
        return probability;
    }

    public LocalDate getCloseDate() {
        return closeDate;
    }

    public OpportunityType getType() {
        return type;
    }

    public LeadSource getLeadSource() {
        return leadSource;
    }

    public String getDescription() {
        return description;
    }

    public String getNextStep() {
        return nextStep;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    private static String required(String field, String value) {
        if (value == null || value.isBlank()) {
            throw new InvalidRequestException(field, "This field is required.");
        }
        return value.strip();
    }

    private static <T> T requiredValue(String field, T value) {
        if (value == null) {
            throw new InvalidRequestException(field, "This field is required.");
        }
        return value;
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static BigDecimal amount(BigDecimal value) {
        if (value == null) {
            throw new InvalidRequestException("amount", "This field is required.");
        }
        if (value.signum() < 0) {
            throw new InvalidRequestException("amount", "Must be zero or greater.");
        }
        return value;
    }
}
