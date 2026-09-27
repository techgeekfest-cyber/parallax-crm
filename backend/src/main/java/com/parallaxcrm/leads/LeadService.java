package com.parallaxcrm.leads;

import com.parallaxcrm.accounts.AccountInput;
import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.accounts.AccountSummary;
import com.parallaxcrm.activities.ActivityLinks;
import com.parallaxcrm.activities.ActivityLog;
import com.parallaxcrm.activities.ActivityType;
import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.leads.internal.Lead;
import com.parallaxcrm.leads.internal.LeadRepository;
import com.parallaxcrm.leads.internal.LeadSpecifications;
import com.parallaxcrm.contacts.ContactInput;
import com.parallaxcrm.contacts.ContactService;
import com.parallaxcrm.contacts.ContactSummary;
import com.parallaxcrm.opportunities.OpportunityInput;
import com.parallaxcrm.opportunities.OpportunityService;
import com.parallaxcrm.opportunities.OpportunitySummary;
import com.parallaxcrm.shared.error.DuplicateRecordException;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.PermissionDeniedException;
import com.parallaxcrm.shared.error.RecordNotFoundException;
import com.parallaxcrm.shared.error.StaleVersionException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Public API of the leads module. Every operation is authorised through {@link AccessPolicy}, and every write runs in
 * a transaction that also records the audit event and, for workflow steps, the timeline activity.
 */
@Service
@Transactional(readOnly = true)
public class LeadService {

    static final String RECORD_TYPE = "Lead";

    private final LeadRepository leads;
    private final AuditTrail auditTrail;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final UserDirectory userDirectory;
    private final ActivityLog activityLog;
    private final AccountService accounts;
    private final ContactService contacts;
    private final OpportunityService opportunities;

    LeadService(LeadRepository leads, AuditTrail auditTrail, CurrentUser currentUser, AccessPolicy accessPolicy,
            UserDirectory userDirectory, ActivityLog activityLog, AccountService accounts, ContactService contacts,
            OpportunityService opportunities) {
        this.leads = leads;
        this.auditTrail = auditTrail;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.userDirectory = userDirectory;
        this.activityLog = activityLog;
        this.accounts = accounts;
        this.contacts = contacts;
        this.opportunities = opportunities;
    }

    @Transactional
    public Lead create(NewLead input) {
        AuthenticatedUser actor = currentUser.require();
        UUID ownerId = input.ownerId() != null ? input.ownerId() : actor.id();
        accessPolicy.requireCanAssignTo(actor, ownerId);
        userDirectory.requireAssignable(ownerId, "ownerId");

        Lead lead = Lead.create(input.firstName(), input.lastName(), input.company(), input.email(),
                input.phone(), input.source(), input.estimatedValue(), input.notes(), ownerId);

        // Friendly duplicate check; the uq_leads_email index remains the guarantee under concurrent inserts.
        if (leads.existsByEmailIgnoreCaseAndArchivedAtIsNull(lead.getEmail())) {
            throw new DuplicateRecordException("lead", "email", lead.getEmail());
        }

        // Flush so the database-generated number is populated and constraint violations surface here.
        Lead saved = leads.saveAndFlush(lead);
        auditTrail.record(AuditAction.CREATE, RECORD_TYPE, saved.getId(), snapshot(saved));
        return saved;
    }

    /** Moves a lead between New, Contacted, Qualified and Disqualified. Converted leads never change. */
    @Transactional
    public Lead changeStatus(UUID id, LeadStatus status, long expectedVersion) {
        Lead lead = get(id);
        if (lead.getVersion() != expectedVersion) {
            throw new StaleVersionException("lead");
        }
        LeadStatus from = lead.getStatus();
        lead.changeStatus(status);
        leads.flush();
        auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, id, Map.of("status", Map.of("from", from, "to", status)));
        activityLog.record(ActivityType.RECORD_UPDATE,
                "Status changed from %s to %s".formatted(Lead.label(from), Lead.label(status)), null,
                ActivityLinks.lead(id));
        return lead;
    }

    /**
     * Converts a qualified lead into an account (new, or an existing one), a contact at that account and an open
     * opportunity on it, then marks the lead Converted and links it to all three.
     *
     * <p>Everything happens in one transaction: the three records with their own audit events and stage history, the
     * lead's CONVERT audit event and the timeline activity. If any step fails — validation, a duplicate contact email,
     * a permission check — nothing is kept. The lead row is locked for the duration, so a second, concurrent attempt
     * waits and then fails with {@code ALREADY_CONVERTED}.
     */
    @Transactional
    public LeadConversionResult convert(UUID id, LeadConversion input) {
        AuthenticatedUser actor = currentUser.require();
        Lead lead = leads.findByIdForUpdate(id)
                .filter(candidate -> !candidate.isArchived())
                .orElseThrow(() -> new RecordNotFoundException(RECORD_TYPE, id));
        accessPolicy.requireCanEditRecordOwnedBy(actor, "lead", lead.getOwnerId());
        // State before version: a repeated click on "Convert" should learn the lead is converted, not that it's stale.
        lead.requireConvertible();
        if (input.version() == null || lead.getVersion() != input.version()) {
            throw new StaleVersionException("lead");
        }
        if (input.existingAccountId() == null && input.account() == null) {
            throw new InvalidRequestException("account", "Describe the new account or choose an existing one.");
        }
        UUID ownerId = input.ownerId() != null ? input.ownerId()
                : lead.getOwnerId() != null ? lead.getOwnerId() : actor.id();

        boolean accountCreated = input.existingAccountId() == null;
        AccountSummary account = accountCreated
                ? step("account", () -> accounts.createFromLead(new AccountInput(input.account().type(),
                        input.account().name(), input.account().website(), input.account().phone(),
                        input.account().industry(), null, null, null, null, ownerId, null, null, null)))
                // Attaching to an existing account doesn't change it; anyone may add contacts and deals to an account.
                : accounts.requireActive(input.existingAccountId(), "existingAccountId");

        var c = input.contact();
        ContactSummary contact = step("contact", () -> contacts.createFromLead(new ContactInput(account.id(),
                c.firstName(), c.lastName(), c.email(), c.phone(), c.title(), null, Boolean.TRUE.equals(c.primary()),
                null, ownerId)));

        var o = input.opportunity();
        OpportunitySummary opportunity = step("opportunity", () -> opportunities.createFromLead(new OpportunityInput(
                account.id(), o.name(), o.amount(), o.stage(), null, o.closeDate(), o.type(), lead.getSource(),
                o.description(), o.nextStep(), ownerId)));

        lead.markConverted(account.id(), contact.id(), opportunity.id());
        leads.flush();

        Map<String, Object> changes = new LinkedHashMap<>();
        changes.put("status", Map.of("from", LeadStatus.QUALIFIED, "to", LeadStatus.CONVERTED));
        changes.put("accountId", account.id());
        changes.put("accountCreated", accountCreated);
        changes.put("contactId", contact.id());
        changes.put("opportunityId", opportunity.id());
        auditTrail.record(AuditAction.CONVERT, RECORD_TYPE, id, changes);
        activityLog.record(ActivityType.LEAD_CONVERSION,
                "Converted lead %s (%s)".formatted(lead.getNumber(), lead.fullName()),
                "%s account %s, added contact %s and opened opportunity %s.".formatted(
                        accountCreated ? "Created" : "Linked to", account.name(), contact.fullName(),
                        opportunity.number()),
                new ActivityLinks(id, account.id(), contact.id(), opportunity.id()));
        return new LeadConversionResult(lead, account, accountCreated, contact, opportunity);
    }

    /**
     * Runs one step of a conversion, reporting field errors under the step's name ({@code contact.email}) so the
     * conversion form can show them next to the right field.
     */
    private static <T> T step(String name, Supplier<T> action) {
        try {
            return action.get();
        } catch (InvalidRequestException invalid) {
            throw invalid.nestedUnder(name);
        } catch (DuplicateRecordException duplicate) {
            throw duplicate.nestedUnder(name);
        }
    }

    public Lead get(UUID id) {
        Lead lead = leads.findById(id)
                .filter(candidate -> !candidate.isArchived())
                .orElseThrow(() -> new RecordNotFoundException(RECORD_TYPE, id));
        accessPolicy.requireAccessToRecordOwnedBy(currentUser.require(), "lead", lead.getOwnerId());
        return lead;
    }

    /**
     * @param ownerId optional owner filter. Reps are always limited to their own leads; asking for someone else's is
     *                refused rather than silently ignored.
     */
    public Page<Lead> list(String query, Collection<LeadStatus> statuses, UUID ownerId, Pageable pageable) {
        AuthenticatedUser actor = currentUser.require();
        UUID effectiveOwner = ownerId;
        if (!accessPolicy.canAccessAllSalesRecords(actor)) {
            if (ownerId != null && !ownerId.equals(actor.id())) {
                throw new PermissionDeniedException("You can only view your own leads.");
            }
            effectiveOwner = actor.id();
        }
        return leads.findAll(LeadSpecifications.matching(query, statuses, effectiveOwner), pageable);
    }

    /** Open (not converted, not disqualified, not archived) leads per owner, for the sales team view. Not authorised. */
    public Map<UUID, Long> countOpenByOwner(Collection<UUID> ownerIds) {
        if (ownerIds.isEmpty()) {
            return Map.of();
        }
        return leads.countOpenByOwner(ownerIds).stream()
                .collect(java.util.stream.Collectors.toMap(LeadRepository.OwnerCount::getOwnerId,
                        LeadRepository.OwnerCount::getTotal));
    }

    private static Map<String, Object> snapshot(Lead lead) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("number", lead.getNumber());
        values.put("firstName", lead.getFirstName());
        values.put("lastName", lead.getLastName());
        values.put("company", lead.getCompany());
        values.put("email", lead.getEmail());
        values.put("phone", lead.getPhone());
        values.put("status", lead.getStatus());
        values.put("source", lead.getSource());
        values.put("estimatedValue", lead.getEstimatedValue());
        values.put("ownerId", lead.getOwnerId());
        values.values().removeIf(Objects::isNull);
        return values;
    }
}
