-- A2: core CRM entities (sales reps, accounts, contacts, opportunities) go live on the V1 relational model.

-- Every contact belongs to an account.
alter table contacts alter column account_id set not null;

-- Enterprise subsidiaries are a simple list of names owned by the account; the database assigns row ids.
alter table enterprise_subsidiaries alter column id set default gen_random_uuid();

-- Opportunities use the same lead-source vocabulary as leads.
alter table opportunities add constraint ck_opportunities_lead_source check (lead_source is null or lead_source in
    ('WEB', 'REFERRAL', 'EVENT', 'PARTNER', 'OUTBOUND', 'ADVERTISING', 'OTHER'));

-- Stage history rows are only ever inserted by the application with a known stage.
alter table opportunity_stage_history add constraint ck_stage_history_to_stage check (to_stage in
    ('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'));

-- Search support for contact emails (names and companies are indexed in V1).
create index ix_contacts_email_trgm on contacts using gin (email gin_trgm_ops);
