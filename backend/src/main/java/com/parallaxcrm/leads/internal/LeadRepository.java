package com.parallaxcrm.leads.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

public interface LeadRepository extends JpaRepository<Lead, UUID>, JpaSpecificationExecutor<Lead> {

    boolean existsByEmailIgnoreCaseAndArchivedAtIsNull(String email);
}
