package com.parallaxcrm.leads;

import com.parallaxcrm.IntegrationTest;
import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.support.Api;
import com.parallaxcrm.support.TestDatabase;
import com.parallaxcrm.support.TestUsers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lead conversion over HTTP against real PostgreSQL: the whole conversion is one transaction, so a failure at any step
 * leaves nothing behind, and a lead converts at most once.
 */
@IntegrationTest
@SuppressWarnings("unchecked")
class LeadConversionIntegrationTests {

    @Autowired
    Api api;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser rep;
    AuthenticatedUser otherRep;
    AuthenticatedUser manager;

    @BeforeEach
    void setUp() {
        database.reset();
        rep = users.create(Role.SALES_REP);
        otherRep = users.create(Role.SALES_REP);
        manager = users.create(Role.SALES_MANAGER);
    }

    @Test
    void aQualifiedLeadBecomesALinkedAccountContactAndOpportunity() {
        String leadId = qualifiedLead(rep, "Ada", "Lovelace", "Analytical Engines", "ada@engines.test");

        MvcTestResult result = api.post(rep, "/api/v1/leads/{id}/conversion", conversion(1), leadId);

        assertThat(result).hasStatus(HttpStatus.CREATED).bodyJson()
                .hasPathSatisfying("$.lead.status", v -> assertThat(v).isEqualTo("CONVERTED"))
                .hasPathSatisfying("$.accountCreated", v -> assertThat(v).isEqualTo(true))
                .hasPathSatisfying("$.account.name", v -> assertThat(v).isEqualTo("Analytical Engines"))
                .hasPathSatisfying("$.contact.name", v -> assertThat(v).isEqualTo("Ada Lovelace"))
                .hasPathSatisfying("$.opportunity.name", v -> assertThat(v).isEqualTo("Engines — platform"));
        var body = api.body(result);
        String accountId = body.get("account").get("id").asString();
        String contactId = body.get("contact").get("id").asString();
        String opportunityId = body.get("opportunity").get("id").asString();

        // The records exist, are linked to each other, and belong to the lead's owner.
        assertThat(api.get(rep, "/api/v1/accounts/{id}", accountId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.type", v -> assertThat(v).isEqualTo("STARTUP"))
                .hasPathSatisfying("$.owner.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
        assertThat(api.get(rep, "/api/v1/contacts/{id}", contactId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.account.id", v -> assertThat(v).isEqualTo(accountId))
                .hasPathSatisfying("$.email", v -> assertThat(v).isEqualTo("ada@engines.test"))
                .hasPathSatisfying("$.primary", v -> assertThat(v).isEqualTo(true));
        assertThat(api.get(rep, "/api/v1/opportunities/{id}", opportunityId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.account.id", v -> assertThat(v).isEqualTo(accountId))
                .hasPathSatisfying("$.stage", v -> assertThat(v).isEqualTo("QUALIFICATION"))
                .hasPathSatisfying("$.leadSource", v -> assertThat(v).isEqualTo("REFERRAL"))
                .hasPathSatisfying("$.stageHistory.length()", v -> assertThat(v).isEqualTo(1));

        // The lead points at what it became.
        assertThat(api.get(rep, "/api/v1/leads/{id}", leadId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("CONVERTED"))
                .hasPathSatisfying("$.conversion.account.id", v -> assertThat(v).isEqualTo(accountId))
                .hasPathSatisfying("$.conversion.contact.id", v -> assertThat(v).isEqualTo(contactId))
                .hasPathSatisfying("$.conversion.opportunity.id", v -> assertThat(v).isEqualTo(opportunityId));
        assertThat(database.count("""
                select count(*) from leads where id = ?::uuid and converted_account_id = ?::uuid
                  and converted_contact_id = ?::uuid and converted_opportunity_id = ?::uuid and converted_at is not null""",
                leadId, accountId, contactId, opportunityId)).isEqualTo(1);

        // Audit: each record's creation plus the conversion itself, all by the rep.
        assertThat(auditActions(leadId)).containsExactly("CREATE", "UPDATE", "CONVERT");
        assertThat(auditActions(accountId)).containsExactly("CREATE");
        assertThat(auditActions(contactId)).containsExactly("CREATE");
        assertThat(auditActions(opportunityId)).containsExactly("CREATE");
        assertThat(database.count("select count(*) from audit_events where action = 'CONVERT' and actor_id = ?::uuid",
                rep.id())).isEqualTo(1);

        // One conversion activity, visible on the lead, account, contact and opportunity timelines.
        assertThat(database.count("""
                select count(*) from activities where type = 'LEAD_CONVERSION' and lead_id = ?::uuid
                  and account_id = ?::uuid and contact_id = ?::uuid and opportunity_id = ?::uuid and actor_id = ?::uuid""",
                leadId, accountId, contactId, opportunityId, rep.id())).isEqualTo(1);
        assertThat(api.get(rep, "/api/v1/activities?opportunityId={id}", opportunityId)).bodyJson()
                .hasPathSatisfying("$.content[0].type", v -> assertThat(v).isEqualTo("LEAD_CONVERSION"))
                .hasPathSatisfying("$.content[0].system", v -> assertThat(v).isEqualTo(true));
    }

    @Test
    void aLeadCanBeConvertedIntoAnExistingAccount() {
        String accountId = api.create(rep, "/api/v1/accounts", Map.of("name", "Existing Co", "type", "SMB"));
        String leadId = qualifiedLead(rep, "Alan", "Turing", "Existing Co", "alan@existing.test");
        var body = conversion(1);
        body.remove("account");
        body.put("existingAccountId", accountId);

        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", body, leadId)).hasStatus(HttpStatus.CREATED)
                .bodyJson()
                .hasPathSatisfying("$.accountCreated", v -> assertThat(v).isEqualTo(false))
                .hasPathSatisfying("$.account.id", v -> assertThat(v).isEqualTo(accountId));
        assertThat(database.count("select count(*) from accounts")).isEqualTo(1);
        assertThat(database.count("select count(*) from contacts where account_id = ?::uuid", accountId)).isEqualTo(1);
    }

    @Test
    void aFailureInAnyStepRollsBackTheWholeConversion() {
        // A contact with the same email already exists, so the contact step fails after the account was created.
        String otherAccount = api.create(rep, "/api/v1/accounts", Map.of("name", "Elsewhere", "type", "SMB"));
        api.create(rep, "/api/v1/contacts", Map.of("accountId", otherAccount, "firstName", "Grace",
                "lastName", "Hopper", "email", "grace@navy.test"));
        String leadId = qualifiedLead(rep, "Grace", "Hopper", "Navy Labs", "grace@navy.test");
        Snapshot before = snapshot();

        var body = conversion(1);
        ((Map<String, Object>) body.get("account")).put("name", "Navy Labs");
        ((Map<String, Object>) body.get("contact")).put("email", "grace@navy.test");
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", body, leadId))
                .hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("DUPLICATE_RECORD"))
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("contact.email"));

        assertThat(snapshot()).isEqualTo(before);
        assertThat(database.count("select count(*) from accounts where name = 'Navy Labs'")).isZero();
        assertThat(api.get(rep, "/api/v1/leads/{id}", leadId)).bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("QUALIFIED"))
                .doesNotHavePath("$.conversion");

        // The last step failing (a closed starting stage) also undoes the account and contact already written.
        var lateFailure = conversion(1);
        ((Map<String, Object>) lateFailure.get("opportunity")).put("stage", "CLOSED_WON");
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", lateFailure, leadId))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("opportunity.stage"));
        assertThat(snapshot()).isEqualTo(before);

        // Once the problem is fixed, the same lead converts cleanly.
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", conversion(1), leadId)).hasStatus(HttpStatus.CREATED);
    }

    @Test
    void aSecondConversionIsRejectedAsAlreadyConverted() {
        String leadId = qualifiedLead(rep, "Katherine", "Johnson", "Orbital", "katherine@orbital.test");
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", conversion(1), leadId)).hasStatus(HttpStatus.CREATED);
        Snapshot afterFirst = snapshot();

        // Same (now stale) version, as from a double click, and the current version: both say ALREADY_CONVERTED.
        for (int version : new int[] {1, 2}) {
            var retry = conversion(version);
            ((Map<String, Object>) retry.get("account")).put("name", "Orbital Two");
            ((Map<String, Object>) retry.get("contact")).put("email", "someone.else@orbital.test");
            assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", retry, leadId))
                    .hasStatus(HttpStatus.CONFLICT).bodyJson()
                    .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("ALREADY_CONVERTED"));
        }
        assertThat(snapshot()).isEqualTo(afterFirst);

        // A converted lead's status is final.
        assertThat(api.post(rep, "/api/v1/leads/{id}/status-transitions", Map.of("status", "NEW", "version", 2), leadId))
                .hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("ALREADY_CONVERTED"));
    }

    @Test
    void simultaneousConversionsProduceExactlyOneSetOfRecords() throws Exception {
        String leadId = qualifiedLead(rep, "Hedy", "Lamarr", "Frequency Hopping", "hedy@hop.test");
        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> attempt = () -> {
            start.await();
            return api.post(rep, "/api/v1/leads/{id}/conversion", conversion(1), leadId).getResponse().getStatus();
        };

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(attempt);
            var second = executor.submit(attempt);
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(201, 409);
        }
        assertThat(database.count("select count(*) from accounts")).isEqualTo(1);
        assertThat(database.count("select count(*) from contacts")).isEqualTo(1);
        assertThat(database.count("select count(*) from opportunities")).isEqualTo(1);
        assertThat(database.count("select count(*) from audit_events where action = 'CONVERT'")).isEqualTo(1);
    }

    @Test
    void onlyQualifiedLeadsWithAFreshVersionCanBeConverted() {
        String leadId = api.create(rep, "/api/v1/leads", lead("Barbara", "Liskov", "Substitution", "barbara@lsp.test"));
        Snapshot before = snapshot();

        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", conversion(0), leadId))
                .hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("INVALID_STATE_TRANSITION"))
                .hasPathSatisfying("$.detail", v -> assertThat(v).asString().contains("Only qualified leads"));

        api.post(rep, "/api/v1/leads/{id}/status-transitions", Map.of("status", "QUALIFIED", "version", 0), leadId);
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", conversion(0), leadId))
                .hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("CONFLICT"));

        var noAccount = conversion(1);
        noAccount.remove("account");
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", noAccount, leadId))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("account"));

        var blankContact = conversion(1);
        ((Map<String, Object>) blankContact.get("contact")).put("lastName", " ");
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", blankContact, leadId))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("VALIDATION_FAILED"))
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("contact.lastName"));

        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", conversion(1), "0198c0de-0000-7000-8000-000000000000"))
                .hasStatus(HttpStatus.NOT_FOUND);
        assertThat(snapshot().accounts()).isEqualTo(before.accounts());
        assertThat(snapshot().contacts()).isEqualTo(before.contacts());
    }

    @Test
    void conversionFollowsTheLeadAccessRules() {
        String leadId = qualifiedLead(rep, "Radia", "Perlman", "Spanning Tree", "radia@stp.test");
        Snapshot before = snapshot();

        // Another rep can't convert (or even see) the lead, and nothing is created.
        assertThat(api.post(otherRep, "/api/v1/leads/{id}/conversion", conversion(1), leadId))
                .hasStatus(HttpStatus.FORBIDDEN).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("PERMISSION_DENIED"));
        // A rep can't hand the converted records to someone else.
        var toOther = conversion(1);
        toOther.put("ownerId", otherRep.id());
        assertThat(api.post(rep, "/api/v1/leads/{id}/conversion", toOther, leadId)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(snapshot()).isEqualTo(before);

        // A manager may convert a rep's lead; the new records belong to the lead's owner.
        MvcTestResult converted = api.post(manager, "/api/v1/leads/{id}/conversion", conversion(1), leadId);
        assertThat(converted).hasStatus(HttpStatus.CREATED);
        String opportunityId = api.body(converted).get("opportunity").get("id").asString();
        assertThat(api.get(rep, "/api/v1/opportunities/{id}", opportunityId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.owner.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
        assertThat(database.count("select count(*) from audit_events where action = 'CONVERT' and actor_id = ?::uuid",
                manager.id())).isEqualTo(1);
    }

    @Test
    void statusChangesAreAuditedAndShownOnTheTimeline() {
        String leadId = api.create(rep, "/api/v1/leads", lead("Frances", "Allen", "Compilers", "frances@ibm.test"));

        assertThat(api.post(rep, "/api/v1/leads/{id}/status-transitions",
                Map.of("status", "CONTACTED", "version", 0), leadId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.status", v -> assertThat(v).isEqualTo("CONTACTED"))
                .hasPathSatisfying("$.version", v -> assertThat(v).isEqualTo(1));
        // A stale version is a conflict, not an overwrite.
        assertThat(api.post(rep, "/api/v1/leads/{id}/status-transitions",
                Map.of("status", "DISQUALIFIED", "version", 0), leadId)).hasStatus(HttpStatus.CONFLICT);
        assertThat(api.post(rep, "/api/v1/leads/{id}/status-transitions",
                Map.of("status", "CONVERTED", "version", 1), leadId)).hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("INVALID_STATE_TRANSITION"));
        assertThat(api.post(otherRep, "/api/v1/leads/{id}/status-transitions",
                Map.of("status", "QUALIFIED", "version", 1), leadId)).hasStatus(HttpStatus.FORBIDDEN);

        assertThat(auditActions(leadId)).containsExactly("CREATE", "UPDATE");
        assertThat(api.get(rep, "/api/v1/activities?leadId={id}", leadId)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1))
                .hasPathSatisfying("$.content[0].type", v -> assertThat(v).isEqualTo("RECORD_UPDATE"))
                .hasPathSatisfying("$.content[0].subject", v -> assertThat(v).isEqualTo("Status changed from New to Contacted"))
                .hasPathSatisfying("$.content[0].actor.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
    }

    // --- helpers ---

    private String qualifiedLead(AuthenticatedUser owner, String first, String last, String company, String email) {
        String id = api.create(owner, "/api/v1/leads", lead(first, last, company, email));
        assertThat(api.post(owner, "/api/v1/leads/{id}/status-transitions", Map.of("status", "QUALIFIED", "version", 0), id))
                .hasStatusOk();
        return id;
    }

    private static Map<String, Object> lead(String first, String last, String company, String email) {
        return Map.of("firstName", first, "lastName", last, "company", company, "email", email,
                "source", "REFERRAL", "estimatedValue", 42000);
    }

    /** A complete conversion body, as the review form sends it; tests remove or change parts of it. */
    private Map<String, Object> conversion(long version) {
        Map<String, Object> account = new HashMap<>(Map.of("type", "STARTUP", "name", "Analytical Engines",
                "website", "https://engines.test"));
        Map<String, Object> contact = new HashMap<>(Map.of("firstName", "Ada", "lastName", "Lovelace",
                "email", "ada@engines.test", "title", "Founder", "primary", true));
        Map<String, Object> opportunity = new HashMap<>(Map.of("name", "Engines — platform", "amount", 42000,
                "closeDate", LocalDate.now().plusMonths(2).toString(), "stage", "QUALIFICATION",
                "type", "NEW_BUSINESS"));
        Map<String, Object> body = new HashMap<>();
        body.put("version", version);
        body.put("account", account);
        body.put("contact", contact);
        body.put("opportunity", opportunity);
        return body;
    }

    private List<String> auditActions(String entityId) {
        return database.jdbc().queryForList(
                "select action from audit_events where entity_id = ?::uuid order by occurred_at, id", String.class,
                entityId);
    }

    private Snapshot snapshot() {
        return new Snapshot(database.count("select count(*) from accounts"),
                database.count("select count(*) from contacts"),
                database.count("select count(*) from opportunities"),
                database.count("select count(*) from opportunity_stage_history"),
                database.count("select count(*) from audit_events"),
                database.count("select count(*) from activities"),
                database.count("select count(*) from leads where status = 'CONVERTED'"));
    }

    /** Row counts of everything a conversion writes. */
    private record Snapshot(int accounts, int contacts, int opportunities, int stageHistory, int auditEvents,
            int activities, int convertedLeads) {
    }
}
