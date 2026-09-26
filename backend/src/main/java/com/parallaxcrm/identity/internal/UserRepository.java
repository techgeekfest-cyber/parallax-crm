package com.parallaxcrm.identity.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    /**
     * Sign-in bookkeeping, deliberately outside the entity lifecycle: it must not bump the optimistic-lock version
     * (an admin editing the user would otherwise get a spurious conflict) or the record's updated_at.
     */
    @Modifying
    @Query("update User u set u.lastLoginAt = :at where u.id = :id")
    void recordLogin(@Param("id") UUID id, @Param("at") Instant at);
}
