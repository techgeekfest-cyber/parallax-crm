package com.parallaxcrm.salesteam;

import com.parallaxcrm.accounts.AccountService;
import com.parallaxcrm.audit.AuditAction;
import com.parallaxcrm.audit.AuditTrail;
import com.parallaxcrm.identity.AccessPolicy;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.identity.DirectoryEntry;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.identity.UserAccounts;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.leads.LeadService;
import com.parallaxcrm.opportunities.OpportunityService;
import com.parallaxcrm.opportunities.OwnerPipeline;
import com.parallaxcrm.salesteam.internal.SalesRepProfile;
import com.parallaxcrm.salesteam.internal.SalesRepProfileRepository;
import com.parallaxcrm.shared.domain.ChangeSet;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.error.PermissionDeniedException;
import com.parallaxcrm.shared.error.RecordNotFoundException;
import com.parallaxcrm.shared.error.StaleVersionException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Public API of the sales team module. Managers and admins see the whole team and set quotas and territories; reps
 * see only themselves. Creating a rep creates their sign-in account (admins only) and their profile together.
 */
@Service
@Transactional(readOnly = true)
public class SalesTeamService {

    static final String RECORD_TYPE = "SalesRep";

    private final SalesRepProfileRepository profiles;
    private final UserDirectory directory;
    private final UserAccounts userAccounts;
    private final LeadService leads;
    private final AccountService accounts;
    private final OpportunityService opportunities;
    private final CurrentUser currentUser;
    private final AccessPolicy accessPolicy;
    private final AuditTrail auditTrail;

    SalesTeamService(SalesRepProfileRepository profiles, UserDirectory directory, UserAccounts userAccounts,
            LeadService leads, AccountService accounts, OpportunityService opportunities, CurrentUser currentUser,
            AccessPolicy accessPolicy, AuditTrail auditTrail) {
        this.profiles = profiles;
        this.directory = directory;
        this.userAccounts = userAccounts;
        this.leads = leads;
        this.accounts = accounts;
        this.opportunities = opportunities;
        this.currentUser = currentUser;
        this.accessPolicy = accessPolicy;
        this.auditTrail = auditTrail;
    }

    public record ProfileInput(String title, String department, String phone, String territory, BigDecimal quota) {
    }

    public Page<SalesRep> list(String query, Boolean active, Pageable pageable) {
        AuthenticatedUser actor = currentUser.require();
        if (!accessPolicy.canAccessAllSalesRecords(actor)) {
            // Reps see only themselves.
            List<DirectoryEntry> self = directory.find(actor.id())
                    .filter(entry -> UserDirectory.SALES_ROLES.contains(entry.role()))
                    .stream().toList();
            return new PageImpl<>(withFigures(self), pageable, self.size());
        }
        Page<DirectoryEntry> people = directory.salesPeople(query, active, pageable);
        return new PageImpl<>(withFigures(people.getContent()), pageable, people.getTotalElements());
    }

    public SalesRep get(UUID userId) {
        AuthenticatedUser actor = currentUser.require();
        if (!accessPolicy.canAccessAllSalesRecords(actor) && !actor.id().equals(userId)) {
            throw new PermissionDeniedException("You can only view your own sales profile.");
        }
        return withFigures(List.of(requireSalesPerson(userId))).getFirst();
    }

    @Transactional
    public SalesRep create(String email, String firstName, String lastName, Role role, String password,
            ProfileInput profile) {
        accessPolicy.requireCanManageUsers(currentUser.require());
        if (!UserDirectory.SALES_ROLES.contains(role)) {
            throw new InvalidRequestException("role", "A sales rep must be a sales rep or a sales manager.");
        }
        DirectoryEntry user = userAccounts.create(email, firstName, lastName, role, password);
        SalesRepProfile saved = profiles.saveAndFlush(apply(new SalesRepProfile(user.id()), profile));
        auditTrail.record(AuditAction.CREATE, RECORD_TYPE, user.id(), withoutNulls(saved.snapshot()));
        return withFigures(List.of(user)).getFirst();
    }

    @Transactional
    public SalesRep updateProfile(UUID userId, ProfileInput input, long expectedVersion) {
        accessPolicy.requireCanManageSalesProfiles(currentUser.require());
        DirectoryEntry user = requireSalesPerson(userId);
        SalesRepProfile profile = profiles.findById(userId).orElseGet(() -> new SalesRepProfile(userId));
        if (profile.getVersion() != expectedVersion) {
            throw new StaleVersionException("sales profile");
        }
        Map<String, Object> before = profile.snapshot();
        apply(profile, input);
        ChangeSet changes = new ChangeSet().diff(before, profile.snapshot());
        if (!changes.isEmpty()) {
            profiles.saveAndFlush(profile);
            auditTrail.record(AuditAction.UPDATE, RECORD_TYPE, userId, changes.asMap());
        }
        return withFigures(List.of(user)).getFirst();
    }

    private static SalesRepProfile apply(SalesRepProfile profile, ProfileInput input) {
        profile.update(input.title(), input.department(), input.phone(), input.territory(),
                input.quota() == null ? BigDecimal.ZERO : input.quota());
        return profile;
    }

    private DirectoryEntry requireSalesPerson(UUID userId) {
        return directory.find(userId)
                .filter(entry -> UserDirectory.SALES_ROLES.contains(entry.role()))
                .orElseThrow(() -> new RecordNotFoundException("Sales rep", userId));
    }

    /** One batched query per figure for the whole page, never one per rep. */
    private List<SalesRep> withFigures(List<DirectoryEntry> people) {
        List<UUID> ids = people.stream().map(DirectoryEntry::id).toList();
        Map<UUID, SalesRepProfile> profileById = profiles.findAllById(ids).stream()
                .collect(Collectors.toMap(SalesRepProfile::getUserId, Function.identity()));
        Map<UUID, Long> openLeads = leads.countOpenByOwner(ids);
        Map<UUID, Long> accountCounts = accounts.countActiveByOwner(ids);
        Map<UUID, OwnerPipeline> pipeline = opportunities.pipelineByOwner(ids, startOfYear());

        return people.stream().map(user -> {
            SalesRepProfile profile = profileById.getOrDefault(user.id(), new SalesRepProfile(user.id()));
            OwnerPipeline figures = pipeline.getOrDefault(user.id(), OwnerPipeline.EMPTY);
            return new SalesRep(user, profile.getTitle(), profile.getDepartment(), profile.getPhone(),
                    profile.getTerritory(), profile.getQuota(), profile.getVersion(),
                    openLeads.getOrDefault(user.id(), 0L), accountCounts.getOrDefault(user.id(), 0L),
                    figures.openCount(), figures.openAmount(), figures.weightedAmount(), figures.wonSince());
        }).toList();
    }

    /** Sales years run on the calendar year, in UTC. */
    static Instant startOfYear() {
        return Year.now(ZoneOffset.UTC).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static Map<String, Object> withoutNulls(Map<String, Object> values) {
        values.values().removeIf(java.util.Objects::isNull);
        return values;
    }
}
