package com.parallaxcrm.salesteam.internal;

import com.parallaxcrm.shared.error.InvalidRequestException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Sales attributes of a user, keyed by the user's id (1:1 with {@code users}). */
@Entity
@Table(name = "sales_reps")
public class SalesRepProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    private String title;

    private String department;

    private String phone;

    private String territory;

    @Column(nullable = false)
    private BigDecimal quota;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Null until first saved, which also tells Spring Data the profile is new. */
    @Version
    private Long version;

    protected SalesRepProfile() {
        // for JPA
    }

    public SalesRepProfile(UUID userId) {
        this.userId = userId;
        this.quota = BigDecimal.ZERO;
    }

    public void update(String title, String department, String phone, String territory, BigDecimal quota) {
        if (quota == null || quota.signum() < 0) {
            throw new InvalidRequestException("quota", "Quota must be zero or greater.");
        }
        this.title = clean(title);
        this.department = clean(department);
        this.phone = clean(phone);
        this.territory = clean(territory);
        this.quota = quota;
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("title", title);
        values.put("department", department);
        values.put("phone", phone);
        values.put("territory", territory);
        values.put("quota", quota);
        return values;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public String getDepartment() {
        return department;
    }

    public String getPhone() {
        return phone;
    }

    public String getTerritory() {
        return territory;
    }

    public BigDecimal getQuota() {
        return quota;
    }

    /**
     * Client-facing version for optimistic locking: 0 while the rep has no saved profile, then Hibernate's version + 1
     * (Hibernate starts saved rows at 0, which would otherwise be indistinguishable from "no profile yet").
     */
    public long getVersion() {
        return version == null ? 0 : version + 1;
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
