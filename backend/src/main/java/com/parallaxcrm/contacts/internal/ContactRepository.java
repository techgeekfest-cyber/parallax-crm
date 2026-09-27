package com.parallaxcrm.contacts.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.UUID;

public interface ContactRepository extends JpaRepository<Contact, UUID>, JpaSpecificationExecutor<Contact> {

    boolean existsByEmailIgnoreCaseAndArchivedAtIsNull(String email);

    boolean existsByEmailIgnoreCaseAndArchivedAtIsNullAndIdNot(String email, UUID id);

    Optional<Contact> findByAccountIdAndPrimaryTrueAndArchivedAtIsNull(UUID accountId);
}
