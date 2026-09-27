package com.parallaxcrm.salesteam.internal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SalesRepProfileRepository extends JpaRepository<SalesRepProfile, UUID> {
}
