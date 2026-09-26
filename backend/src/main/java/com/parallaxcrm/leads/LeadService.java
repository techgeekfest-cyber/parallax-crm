package com.parallaxcrm.leads;

import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.leads.internal.Lead;
import com.parallaxcrm.leads.internal.LeadRepository;
import com.parallaxcrm.leads.internal.LeadSpecifications;
import com.parallaxcrm.shared.error.DuplicateRecordException;
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
 * Public API of the leads module. Every write runs in a transaction that also records the audit event.
 */
@Service
@Transactional(readOnly = true)
public class LeadService {

    static final String RECORD_TYPE = "Lead";

    private final LeadRepository leads;
    private final AuditTrail auditTrail;

    LeadService(LeadRepository leads, AuditTrail auditTrail) {
        this.leads = leads;
        this.auditTrail = auditTrail;
    }

    @Transactional
    public Lead create(NewLead input) {
        Lead lead = Lead.create(input.firstName(), input.lastName(), input.company(), input.email(),
                input.phone(), input.source(), input.estimatedValue(), input.notes());

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
        return leads.findById(id)
                .filter(lead -> !lead.isArchived())
                .orElseThrow(() -> new RecordNotFoundException(RECORD_TYPE, id));
    }

    public Page<Lead> list(String query, Collection<LeadStatus> statuses, Pageable pageable) {
        return leads.findAll(LeadSpecifications.matching(query, statuses), pageable);
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
        values.values().removeIf(Objects::isNull);
        return values;
    }
}
