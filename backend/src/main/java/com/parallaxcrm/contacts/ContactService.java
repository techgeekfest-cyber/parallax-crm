package com.parallaxcrm.contacts;

import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.contacts.internal.Contact;
import com.parallaxcrm.contacts.internal.ContactRepository;
import com.parallaxcrm.contacts.internal.ContactSpecifications;
import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.shared.domain.ChangeSet;
import com.parallaxcrm.shared.error.DuplicateRecordException;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.RecordNotFoundException;
import com.parallaxcrm.shared.error.StaleVersionException;
import com.parallaxcrm.shared.web.RecordPermissions;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Public API of the contacts module. Contacts are shared like accounts: everyone reads, owners (and managers/admins)
 * edit, managers/admins archive. Making a contact primary demotes the account's previous primary contact.
 */
@Service
@Transactional(readOnly = true)
public class ContactService {

    static final String RECORD_TYPE = "Contact";

    private final ContactRepository contacts;
    private final AccountService accounts;
    private final AuditTrail auditTrail;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final UserDirectory userDirectory;

    ContactService(ContactRepository contacts, AccountService accounts, AuditTrail auditTrail,
            CurrentUser currentUser, AccessPolicy accessPolicy, UserDirectory userDirectory) {
        this.contacts = contacts;
        this.accounts = accounts;
        this.auditTrail = auditTrail;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.userDirectory = userDirectory;
    }

    @Transactional
    public Contact create(ContactInput input) {
        AuthenticatedUser actor = currentUser.require();
        UUID ownerId = input.ownerId() != null ? input.ownerId() : actor.id();
        accessPolicy.requireCanAssignTo(actor, ownerId);
        userDirectory.requireAssignable(ownerId, "ownerId");
        accounts.requireActive(input.accountId(), "accountId");

        Contact contact = Contact.create(input, ownerId);
        requireUniqueEmail(contact.getEmail(), null);
        if (contact.isPrimary()) {
            demoteCurrentPrimary(contact.getAccountId(), null);
        }
        Contact saved = contacts.saveAndFlush(contact);
        Map<String, Object> snapshot = saved.snapshot();
        snapshot.values().removeIf(Objects::isNull);
        snapshot.put("number", saved.getNumber());
        auditTrail.record(AuditAction.CREATE, RECORD_TYPE, saved.getId(), snapshot);
        return saved;
    }

    @Transactional
    public Contact update(UUID id, ContactInput input, long expectedVersion) {
        AuthenticatedUser actor = currentUser.require();
        Contact contact = find(id);
        accessPolicy.requireCanEditRecordOwnedBy(actor, "contact", contact.getOwnerId());
        if (contact.getVersion() != expectedVersion) {
            throw new StaleVersionException("contact");
        }
        if (contact.isArchived()) {
            throw new InvalidRequestException("Restore this contact before editing it.");
        }
        UUID ownerId = input.ownerId() != null ? input.ownerId() : contact.getOwnerId();
        if (!Objects.equals(ownerId, contact.getOwnerId())) {
            accessPolicy.requireCanAssignTo(actor, ownerId);
            userDirectory.requireAssignable(ownerId, "ownerId");
        }
        if (!Objects.equals(input.accountId(), contact.getAccountId())) {
            accounts.requireActive(input.accountId(), "accountId");
        }

        // Validate and demote before touching this contact: queries auto-flush pending changes, and a second primary
        // must never reach the database, even for a moment.
        requireUniqueEmail(Contact.normaliseEmail(input.email()), contact.getId());
        if (input.primary()) {
            demoteCurrentPrimary(input.accountId(), contact.getId());
        }
        Map<String, Object> before = contact.snapshot();
        contact.update(input, ownerId);
        ChangeSet changes = new ChangeSet().diff(before, contact.snapshot());
        if (!changes.isEmpty()) {
            contacts.flush();
            auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, contact.getId(), changes.asMap());
        }
        return contact;
    }

    public Contact get(UUID id) {
        currentUser.require();
        return find(id);
    }

    public Page<Contact> list(String query, UUID accountId, UUID ownerId, boolean archived, Pageable pageable) {
        currentUser.require();
        return contacts.findAll(ContactSpecifications.matching(query, accountId, ownerId, archived), pageable);
    }

    @Transactional
    public Contact archive(UUID id) {
        accessPolicy.requireCanArchive(currentUser.require(), "contact");
        Contact contact = find(id);
        boolean wasPrimary = contact.isPrimary();
        contact.archive();
        contacts.flush();
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("name", contact.fullName());
        if (wasPrimary) {
            details.put("primary", Map.of("from", true, "to", false));
        }
        auditTrail.record(AuditAction.ARCHIVE, RECORD_TYPE, id, details);
        return contact;
    }

    @Transactional
    public Contact restore(UUID id) {
        accessPolicy.requireCanArchive(currentUser.require(), "contact");
        Contact contact = find(id);
        accounts.requireActive(contact.getAccountId(), "accountId");
        if (contact.getEmail() != null && contacts.existsByEmailIgnoreCaseAndArchivedAtIsNull(contact.getEmail())) {
            throw new DuplicateRecordException("contact", "email", contact.getEmail());
        }
        contact.restore();
        contacts.flush();
        auditTrail.record(AuditAction.RESTORE, RECORD_TYPE, id, Map.of("name", contact.fullName()));
        return contact;
    }

    public RecordPermissions permissionsFor(Contact contact) {
        AuthenticatedUser actor = currentUser.require();
        return new RecordPermissions(
                !contact.isArchived() && accessPolicy.canAccessRecordOwnedBy(actor, contact.getOwnerId()),
                accessPolicy.canArchiveSalesRecords(actor));
    }

    private void requireUniqueEmail(String email, UUID contactId) {
        if (email == null) {
            return;
        }
        boolean taken = contactId == null
                ? contacts.existsByEmailIgnoreCaseAndArchivedAtIsNull(email)
                : contacts.existsByEmailIgnoreCaseAndArchivedAtIsNullAndIdNot(email, contactId);
        if (taken) {
            throw new DuplicateRecordException("contact", "email", email);
        }
    }

    /**
     * Keeps "one primary contact per account" true: the previous primary is demoted (and audited) and flushed
     * before the new primary is written, so the database's partial unique index is never violated.
     */
    private void demoteCurrentPrimary(UUID accountId, UUID newPrimaryId) {
        contacts.findByAccountIdAndPrimaryTrueAndArchivedAtIsNull(accountId)
                .filter(current -> !current.getId().equals(newPrimaryId))
                .ifPresent(current -> {
                    current.demoteFromPrimary();
                    contacts.flush();
                    auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, current.getId(),
                            Map.of("primary", Map.of("from", true, "to", false)));
                });
    }

    private Contact find(UUID id) {
        return contacts.findById(id).orElseThrow(() -> new RecordNotFoundException(RECORD_TYPE, id));
    }
}
