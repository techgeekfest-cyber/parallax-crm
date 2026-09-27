package com.parallaxcrm.support;

import org.springframework.jdbc.core.JdbcTemplate;

/** Returns the shared test database to an empty, freshly migrated state. */
public class TestDatabase {

    private final JdbcTemplate jdbc;

    TestDatabase(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void reset() {
        jdbc.execute("""
                truncate table leads, opportunity_stage_history, opportunities, contacts, enterprise_subsidiaries,
                    enterprise_accounts, smb_accounts, startup_accounts, accounts, sales_reps, activities, audit_events,
                    spring_session, users cascade""");
    }

    public int count(String sql, Object... args) {
        Integer count = jdbc.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    public JdbcTemplate jdbc() {
        return jdbc;
    }
}
