package com.parallaxcrm.leads;

import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.leads.internal.Lead;
import com.parallaxcrm.leads.internal.LeadRepository;
import com.parallaxcrm.leads.internal.LeadSpecifications;
import com.parallaxcrm.shared.error.DuplicateRecordException;
import com.parallaxcrm.shared.error.PermissionDeniedException;
import com.parallaxcrm.shared.error.RecordNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Public API of the leads module. Every operation is authorised through {@link AccessPolicy}, and every write runs in
 * a transaction that also records the audit event.
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

    LeadService(LeadRepository leads, AuditTrail auditTrail, CurrentUser currentUser, AccessPolicy accessPolicy,
            UserDirectory userDirectory) {
        this.leads = leads;
        this.auditTrail = auditTrail;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.userDirectory = userDirectory;
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
