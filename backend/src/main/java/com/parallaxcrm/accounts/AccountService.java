package com.parallaxcrm.accounts;

import com.parallaxcrm.accounts.internal.Account;
import com.parallaxcrm.accounts.internal.AccountRepository;
import com.parallaxcrm.accounts.internal.AccountSpecifications;
import com.parallaxcrm.accounts.internal.EnterpriseAccount;
import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
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

import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Public API of the accounts module. Accounts are shared reference data: every signed-in user may read them, owners
 * (and managers/admins) may edit them, and only managers/admins may archive or restore them.
 */
@Service
@Transactional(readOnly = true)
public class AccountService {

    static final String RECORD_TYPE = "Account";

    private final AccountRepository accounts;
    private final AuditTrail auditTrail;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final UserDirectory userDirectory;

    AccountService(AccountRepository accounts, AuditTrail auditTrail, CurrentUser currentUser,
            AccessPolicy accessPolicy, UserDirectory userDirectory) {
        this.accounts = accounts;
        this.auditTrail = auditTrail;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.userDirectory = userDirectory;
    }

    @Transactional
    public Account create(AccountInput input) {
        AuthenticatedUser actor = currentUser.require();
        UUID ownerId = input.ownerId() != null ? input.ownerId() : actor.id();
        accessPolicy.requireCanAssignTo(actor, ownerId);
        userDirectory.requireAssignable(ownerId, "ownerId");
        requireAccountManager(input, null);

        Account account = Account.create(input, ownerId);
        if (accounts.existsByNameIgnoreCaseAndArchivedAtIsNull(account.getName())) {
            throw new DuplicateRecordException("account", "name", account.getName());
        }
        Account saved = accounts.saveAndFlush(account);
        auditTrail.record(AuditAction.CREATE, RECORD_TYPE, saved.getId(), withoutNulls(saved.snapshot()));
        return initialized(saved);
    }

    @Transactional
    public Account update(UUID id, AccountInput input, long expectedVersion) {
        AuthenticatedUser actor = currentUser.require();
        Account account = find(id);
        accessPolicy.requireCanEditRecordOwnedBy(actor, "account", account.getOwnerId());
        if (account.getVersion() != expectedVersion) {
            throw new StaleVersionException("account");
        }
        if (account.isArchived()) {
            throw new InvalidRequestException("Restore this account before editing it.");
        }
        UUID ownerId = input.ownerId() != null ? input.ownerId() : account.getOwnerId();
        if (!Objects.equals(ownerId, account.getOwnerId())) {
            accessPolicy.requireCanAssignTo(actor, ownerId);
            userDirectory.requireAssignable(ownerId, "ownerId");
        }
        requireAccountManager(input, account);

        Map<String, Object> before = account.snapshot();
        account.update(input, ownerId);
        if (accounts.existsByNameIgnoreCaseAndArchivedAtIsNullAndIdNot(account.getName(), account.getId())) {
            throw new DuplicateRecordException("account", "name", account.getName());
        }
        ChangeSet changes = new ChangeSet().diff(before, account.snapshot());
        if (!changes.isEmpty()) {
            accounts.flush();
            auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, account.getId(), changes.asMap());
        }
        return initialized(account);
    }

    /** Archived accounts can still be opened (to restore them), so this does not hide them. */
    public Account get(UUID id) {
        currentUser.require();
        return initialized(find(id));
    }

    public Page<Account> list(String query, AccountType type, UUID ownerId, boolean archived, Pageable pageable) {
        currentUser.require();
        return accounts.findAll(AccountSpecifications.matching(query, type, ownerId, archived), pageable);
    }

    @Transactional
    public Account archive(UUID id) {
        accessPolicy.requireCanArchive(currentUser.require(), "account");
        Account account = find(id);
        account.archive();
        accounts.flush();
        auditTrail.record(AuditAction.ARCHIVE, RECORD_TYPE, id, Map.of("name", account.getName()));
        return initialized(account);
    }

    @Transactional
    public Account restore(UUID id) {
        accessPolicy.requireCanArchive(currentUser.require(), "account");
        Account account = find(id);
        if (accounts.existsByNameIgnoreCaseAndArchivedAtIsNull(account.getName())) {
            throw new DuplicateRecordException("account", "name", account.getName());
        }
        account.restore();
        accounts.flush();
        auditTrail.record(AuditAction.RESTORE, RECORD_TYPE, id, Map.of("name", account.getName()));
        return initialized(account);
    }

    public RecordPermissions permissionsFor(Account account) {
        AuthenticatedUser actor = currentUser.require();
        return new RecordPermissions(
                !account.isArchived() && accessPolicy.canAccessRecordOwnedBy(actor, account.getOwnerId()),
                accessPolicy.canArchiveSalesRecords(actor));
    }

    /**
     * For lead conversion: creates the account under the same rules as {@link #create} (including authorisation), as
     * part of the caller's transaction, and returns the public summary other modules may use.
     */
    @Transactional
    public AccountSummary createFromLead(AccountInput input) {
        return create(input).toSummary();
    }

    // --- For other modules. These do not authorise; callers apply their own policy. ---

    public Map<UUID, AccountSummary> summaries(Collection<UUID> ids) {
        var distinct = ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (distinct.isEmpty()) {
            return Map.of();
        }
        return accounts.findAllById(distinct).stream()
                .map(Account::toSummary)
                .collect(Collectors.toMap(AccountSummary::id, Function.identity()));
    }

    /** Contacts and opportunities can only be attached to an existing, non-archived account. */
    public AccountSummary requireActive(UUID accountId, String field) {
        if (accountId == null) {
            throw new InvalidRequestException(field, "Choose an account.");
        }
        return accounts.findById(accountId)
                .filter(account -> !account.isArchived())
                .map(Account::toSummary)
                .orElseThrow(() -> new InvalidRequestException(field, "Choose an active account."));
    }

    public Map<UUID, Long> countActiveByOwner(Collection<UUID> ownerIds) {
        if (ownerIds.isEmpty()) {
            return Map.of();
        }
        return accounts.countActiveByOwner(ownerIds).stream()
                .collect(Collectors.toMap(AccountRepository.OwnerCount::getOwnerId, AccountRepository.OwnerCount::getTotal));
    }

    private Account find(UUID id) {
        return accounts.findById(id).orElseThrow(() -> new RecordNotFoundException(RECORD_TYPE, id));
    }

    /** The enterprise account manager must be an active user; unchanged values are accepted as they are. */
    private void requireAccountManager(AccountInput input, Account existing) {
        UUID managerId = input.enterprise() == null ? null : input.enterprise().accountManagerId();
        UUID current = existing instanceof EnterpriseAccount enterprise ? enterprise.getAccountManagerId() : null;
        if (managerId != null && !managerId.equals(current)) {
            userDirectory.requireAssignable(managerId, "enterprise.accountManagerId");
        }
    }

    /** Loads lazy subtype collections while the transaction is open (the web layer maps outside it). */
    private static Account initialized(Account account) {
        if (account instanceof EnterpriseAccount enterprise) {
            enterprise.profile(); // copies the subsidiaries collection, which loads it
        }
        return account;
    }

    private static Map<String, Object> withoutNulls(Map<String, Object> values) {
        values.values().removeIf(Objects::isNull);
        return values;
    }
}
