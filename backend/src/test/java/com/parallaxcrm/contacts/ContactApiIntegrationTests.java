package com.parallaxcrm.contacts;

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

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class ContactApiIntegrationTests {

    @Autowired
    Api api;

    @Autowired
    TestDatabase database;

    @Autowired
    TestUsers users;

    AuthenticatedUser rep;
    AuthenticatedUser otherRep;
    AuthenticatedUser manager;
    String accountId;

    @BeforeEach
    void setUp() {
        database.reset();
        rep = users.create(Role.SALES_REP);
        otherRep = users.create(Role.SALES_REP);
        manager = users.create(Role.SALES_MANAGER);
        accountId = api.create(rep, "/api/v1/accounts", Map.of("name", "Northwind Traders", "type", "SMB"));
    }

    @Test
    void aContactIsCreatedOnItsAccountAndReadableByEveryone() {
        var body = contact("Maria", "Anders", "Maria.Anders@Northwind.test");
        body.put("title", "Head of Procurement");
        body.put("mailingAddress", Map.of("city", "Berlin", "country", "DE"));

        String id = api.create(rep, "/api/v1/contacts", body);

        assertThat(api.get(otherRep, "/api/v1/contacts/{id}", id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.number", v -> assertThat(v).asString().matches("CON-\\d{6}"))
                .hasPathSatisfying("$.email", v -> assertThat(v).isEqualTo("maria.anders@northwind.test"))
                .hasPathSatisfying("$.account.id", v -> assertThat(v).isEqualTo(accountId))
                .hasPathSatisfying("$.account.name", v -> assertThat(v).isEqualTo("Northwind Traders"))
                .hasPathSatisfying("$.mailingAddress.city", v -> assertThat(v).isEqualTo("Berlin"))
                .hasPathSatisfying("$.owner.id", v -> assertThat(v).isEqualTo(rep.id().toString()));
        assertThat(api.get(rep, "/api/v1/contacts?accountId={id}", accountId)).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(1));
    }

    @Test
    void aContactNeedsAnActiveAccount() {
        var noAccount = contact("No", "Account", null);
        noAccount.remove("accountId");
        assertThat(api.post(rep, "/api/v1/contacts", noAccount)).hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("accountId"));

        var unknown = contact("Ghost", "Account", null);
        unknown.put("accountId", UUID.randomUUID());
        assertThat(api.post(rep, "/api/v1/contacts", unknown)).hasStatus(HttpStatus.BAD_REQUEST);

        api.post(manager, "/api/v1/accounts/{id}/archive", null, accountId);
        assertThat(api.post(rep, "/api/v1/contacts", contact("Late", "Arrival", null)))
                .hasStatus(HttpStatus.BAD_REQUEST).bodyJson()
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("accountId"));
    }

    @Test
    void contactEmailsAreUniqueCaseInsensitively() {
        api.create(rep, "/api/v1/contacts", contact("Ana", "Trujillo", "ana@trujillo.test"));

        assertThat(api.post(otherRep, "/api/v1/contacts", contact("Ana", "T.", "ANA@trujillo.test")))
                .hasStatus(HttpStatus.CONFLICT).bodyJson()
                .hasPathSatisfying("$.code", v -> assertThat(v).isEqualTo("DUPLICATE_RECORD"))
                .hasPathSatisfying("$.fieldErrors[0].field", v -> assertThat(v).isEqualTo("email"));
    }

    @Test
    void makingAContactPrimaryDemotesThePreviousPrimary() {
        var first = contact("Thomas", "Hardy", null);
        first.put("primary", true);
        String firstId = api.create(rep, "/api/v1/contacts", first);
        var second = contact("Christina", "Berglund", null);
        second.put("primary", true);

        String secondId = api.create(rep, "/api/v1/contacts", second);

        assertThat(api.body(api.get(rep, "/api/v1/contacts/{id}", firstId)).get("primary").asBoolean()).isFalse();
        assertThat(api.body(api.get(rep, "/api/v1/contacts/{id}", secondId)).get("primary").asBoolean()).isTrue();
        assertThat(database.count("select count(*) from contacts where account_id = ?::uuid and is_primary", accountId))
                .isEqualTo(1);
        assertThat(database.count("select count(*) from audit_events where entity_id = ?::uuid and action = 'UPDATE' "
                + "and changes->'primary'->>'to' = 'false'", firstId)).isEqualTo(1);

        // Promoting the first one again through an update demotes the second.
        var promote = contact("Thomas", "Hardy", null);
        promote.put("primary", true);
        promote.put("version", 1);
        assertThat(api.put(rep, "/api/v1/contacts/{id}", promote, firstId)).hasStatusOk();
        assertThat(database.count("select count(*) from contacts where id = ?::uuid and is_primary", firstId)).isEqualTo(1);
        assertThat(database.count("select count(*) from contacts where account_id = ?::uuid and is_primary", accountId))
                .isEqualTo(1);
    }

    @Test
    void archivingAPrimaryContactFreesThePrimarySlot() {
        var primary = contact("Hanna", "Moos", null);
        primary.put("primary", true);
        String id = api.create(rep, "/api/v1/contacts", primary);

        assertThat(api.post(manager, "/api/v1/contacts/{id}/archive", null, id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.primary", v -> assertThat(v).isEqualTo(false));
        assertThat(api.get(rep, "/api/v1/contacts")).bodyJson()
                .hasPathSatisfying("$.totalElements", v -> assertThat(v).isEqualTo(0));
    }

    @Test
    void onlyTheOwnerOrAManagerEditsAndOnlyManagersArchive() {
        String id = api.create(rep, "/api/v1/contacts", contact("Frédérique", "Citeaux", null));
        var update = contact("Frédérique", "Citeaux", null);
        update.put("title", "Marketing Manager");
        update.put("version", 0);

        assertThat(api.put(otherRep, "/api/v1/contacts/{id}", update, id)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.post(rep, "/api/v1/contacts/{id}/archive", null, id)).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(api.put(rep, "/api/v1/contacts/{id}", update, id)).hasStatusOk().bodyJson()
                .hasPathSatisfying("$.title", v -> assertThat(v).isEqualTo("Marketing Manager"));
        assertThat(api.put(rep, "/api/v1/contacts/{id}", update, id)).hasStatus(HttpStatus.CONFLICT);
    }

    @Test
    void listSearchesByNameEmailAndTitle() {
        var a = contact("Laurence", "Lebihan", "laurence@bon.test");
        a.put("title", "Owner");
        api.create(rep, "/api/v1/contacts", a);
        api.create(rep, "/api/v1/contacts", contact("Elizabeth", "Lincoln", "liz@bottom.test"));

        assertThat(api.get(rep, "/api/v1/contacts?q=owner")).bodyJson()
                .hasPathSatisfying("$.content[*].fullName", v -> assertThat(v).asArray().containsExactly("Laurence Lebihan"));
        assertThat(api.get(rep, "/api/v1/contacts?q=BOTTOM")).bodyJson()
                .hasPathSatisfying("$.content[*].fullName", v -> assertThat(v).asArray().containsExactly("Elizabeth Lincoln"));
        assertThat(api.get(rep, "/api/v1/contacts?sort=lastName,desc")).bodyJson()
                .hasPathSatisfying("$.content[*].fullName", v -> assertThat(v).asArray()
                        .containsExactly("Elizabeth Lincoln", "Laurence Lebihan"));
    }

    private Map<String, Object> contact(String first, String last, String email) {
        Map<String, Object> body = new HashMap<>();
        body.put("accountId", accountId);
        body.put("firstName", first);
        body.put("lastName", last);
        if (email != null) {
            body.put("email", email);
        }
        return body;
    }
}
