package com.parallaxcrm.leads.internal;

import com.parallaxcrm.shared.domain.LeadSource;
import com.parallaxcrm.leads.LeadStatus;
import com.parallaxcrm.shared.domain.AbstractEntity;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.WorkflowRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * A prospective customer. Created through {@link #create}, which normalises and validates input, so a {@code Lead}
 * instance is always in a valid state. Status changes go through {@link #changeStatus}; the terminal
 * {@code CONVERTED} status is reached only through {@link #markConverted}, which records what the lead became.
 *
 * <p>Status workflow: while a lead is being worked it may move freely between New, Contacted, Qualified and
 * Disqualified (qualification is a judgement people revise). Only a Qualified lead can be converted, and a converted
 * lead never changes again.
 */
@Entity
@Table(name = "leads")
public class Lead extends AbstractEntity {

    /** Human-readable identifier such as {@code LD-000042}, assigned by a database sequence on insert. */
    @Generated
    @Column(insertable = false, updatable = false)
    private String number;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(nullable = false)
    private String company;

    @Column(nullable = false)
    private String email;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LeadStatus status;

    @Enumerated(EnumType.STRING)
    private LeadSource source;

    @Column(name = "estimated_value")
    private BigDecimal estimatedValue;

    private String notes;

    /** The user responsible for this lead. Reps only see leads they own. */
    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "converted_account_id")
    private UUID convertedAccountId;

    @Column(name = "converted_contact_id")
    private UUID convertedContactId;

    @Column(name = "converted_opportunity_id")
    private UUID convertedOpportunityId;

    @Column(name = "converted_at")
    private Instant convertedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Lead() {
        // for JPA
    }

    public static Lead create(String firstName, String lastName, String company, String email, String phone,
            LeadSource source, BigDecimal estimatedValue, String notes, UUID ownerId) {
        Lead lead = new Lead();
        lead.firstName = required("firstName", firstName);
        lead.lastName = required("lastName", lastName);
        lead.company = required("company", company);
        lead.email = normaliseEmail(email);
        lead.phone = optional(phone);
        lead.source = source;
        lead.estimatedValue = nonNegative("estimatedValue", estimatedValue);
        lead.notes = optional(notes);
        lead.ownerId = ownerId;
        lead.status = LeadStatus.NEW;
        return lead;
    }

    public static String normaliseEmail(String email) {
        return required("email", email).toLowerCase(Locale.ROOT);
    }

    public void changeStatus(LeadStatus next) {
        if (next == null) {
            throw new InvalidRequestException("status", "Choose a status.");
        }
        requireNotConverted();
        if (next == LeadStatus.CONVERTED) {
            throw WorkflowRuleException.invalidTransition("A lead becomes Converted by converting it, not by a status change.");
        }
        if (next == status) {
            throw WorkflowRuleException.invalidTransition("This lead is already %s.".formatted(label(status)));
        }
        status = next;
    }

    /** Checks the lead can be converted right now, before anything is created from it. */
    public void requireConvertible() {
        requireNotConverted();
        if (status != LeadStatus.QUALIFIED) {
            throw WorkflowRuleException.invalidTransition(
                    "Only qualified leads can be converted. This lead is %s — qualify it first.".formatted(label(status)));
        }
    }

    /** Links the lead to the records it became. The database requires account and contact for a converted lead. */
    public void markConverted(UUID accountId, UUID contactId, UUID opportunityId) {
        requireConvertible();
        this.convertedAccountId = java.util.Objects.requireNonNull(accountId);
        this.convertedContactId = java.util.Objects.requireNonNull(contactId);
        this.convertedOpportunityId = opportunityId;
        this.convertedAt = Instant.now();
        this.status = LeadStatus.CONVERTED;
    }

    public boolean isConverted() {
        return status == LeadStatus.CONVERTED;
    }

    private void requireNotConverted() {
        if (isConverted()) {
            throw WorkflowRuleException.alreadyConverted("This lead has already been converted.");
        }
    }

    public static String label(LeadStatus status) {
        String word = status.name().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(word.charAt(0)) + word.substring(1);
    }

    public String fullName() {
        return firstName + " " + lastName;
    }

    public boolean isArchived() {
        return archivedAt != null;
    }

    public String getNumber() {
        return number;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getCompany() {
        return company;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public LeadStatus getStatus() {
        return status;
    }

    public LeadSource getSource() {
        return source;
    }

    public BigDecimal getEstimatedValue() {
        return estimatedValue;
    }

    public String getNotes() {
        return notes;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public UUID getConvertedAccountId() {
        return convertedAccountId;
    }

    public UUID getConvertedContactId() {
        return convertedContactId;
    }

    public UUID getConvertedOpportunityId() {
        return convertedOpportunityId;
    }

    public Instant getConvertedAt() {
        return convertedAt;
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

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static BigDecimal nonNegative(String field, BigDecimal value) {
        if (value != null && value.signum() < 0) {
            throw new InvalidRequestException(field, "Must be zero or greater.");
        }
        return value;
    }
}
