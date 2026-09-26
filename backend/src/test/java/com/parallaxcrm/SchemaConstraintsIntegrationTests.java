package com.parallaxcrm;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The database enforces invariants independently of the application, so a bug or a manual SQL edit cannot
 * produce impossible states.
 */
@IntegrationTest
class SchemaConstraintsIntegrationTests {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void convertedLeadMustReferenceItsConversionRecords() {
        assertThatThrownBy(() -> jdbc.update("""
                insert into leads (id, first_name, last_name, company, email, status, created_at, updated_at)
                values (gen_random_uuid(), 'Ada', 'Lovelace', 'Analytical', 'constraint-test@example.com',
                        'CONVERTED', now(), now())
                """))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_leads_conversion");
    }

    @Test
    void leadStatusIsRestrictedToKnownValues() {
        assertThatThrownBy(() -> jdbc.update("""
                insert into leads (id, first_name, last_name, company, email, status, created_at, updated_at)
                values (gen_random_uuid(), 'Ada', 'Lovelace', 'Analytical', 'status-test@example.com',
                        'WON', now(), now())
                """))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_leads_status");
    }

    @Test
    void opportunityProbabilityMustBeAPercentage() {
        assertThatThrownBy(() -> jdbc.update("""
                with account as (
                    insert into accounts (id, account_type, name, created_at, updated_at)
                    values (gen_random_uuid(), 'SMB', 'Probability Test Co', now(), now())
                    returning id
                )
                insert into opportunities (id, account_id, name, stage, probability, close_date, created_at, updated_at)
                select gen_random_uuid(), id, 'Bad deal', 'PROSPECTING', 150, current_date, now(), now() from account
                """))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_opportunities_probability");
    }
}
