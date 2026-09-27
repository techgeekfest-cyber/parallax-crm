package com.parallaxcrm.accounts.internal;

import com.parallaxcrm.accounts.AccountInput;
import com.parallaxcrm.accounts.AccountSummary;
import com.parallaxcrm.accounts.AccountTier;
import com.parallaxcrm.accounts.AccountType;
import com.parallaxcrm.accounts.SupportLevel;
import com.parallaxcrm.shared.domain.AbstractEntity;
import com.parallaxcrm.shared.domain.Address;
import com.parallaxcrm.shared.error.InvalidRequestException;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorColumn;
import jakarta.persistence.DiscriminatorType;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * An organisation the company sells to. Stored with JOINED inheritance: shared columns in {@code accounts}, subtype
 * columns in {@code enterprise_accounts}, {@code smb_accounts} or {@code startup_accounts}.
 *
 * <p>Subtypes supply their own business rules: how they are tiered and what support they receive.
 */
@Entity
@Table(name = "accounts")
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "account_type", discriminatorType = DiscriminatorType.STRING, length = 20)
public abstract class Account extends AbstractEntity {

    @Generated
    @Column(insertable = false, updatable = false)
    private String number;

    @Column(nullable = false)
    private String name;

    private String website;

    private String phone;

    private String industry;

    @Column(name = "employee_count")
    private Integer employeeCount;

    @Column(name = "annual_revenue")
    private BigDecimal annualRevenue;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "street", column = @Column(name = "billing_street")),
            @AttributeOverride(name = "city", column = @Column(name = "billing_city")),
            @AttributeOverride(name = "state", column = @Column(name = "billing_state")),
            @AttributeOverride(name = "postalCode", column = @Column(name = "billing_postal_code")),
            @AttributeOverride(name = "country", column = @Column(name = "billing_country"))})
    private Address billingAddress;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "street", column = @Column(name = "shipping_street")),
            @AttributeOverride(name = "city", column = @Column(name = "shipping_city")),
            @AttributeOverride(name = "state", column = @Column(name = "shipping_state")),
            @AttributeOverride(name = "postalCode", column = @Column(name = "shipping_postal_code")),
            @AttributeOverride(name = "country", column = @Column(name = "shipping_country"))})
    private Address shippingAddress;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Account() {
        // for JPA
    }

    /** Creates the subtype matching {@code input.type()}, validated and ready to persist. */
    public static Account create(AccountInput input, UUID ownerId) {
        Account account = switch (required("type", input.type())) {
            case ENTERPRISE -> new EnterpriseAccount();
            case SMB -> new SmbAccount();
            case STARTUP -> new StartupAccount();
        };
        account.update(input, ownerId);
        return account;
    }

    /** Full replacement of the editable fields. The account type itself never changes. */
    public void update(AccountInput input, UUID ownerId) {
        if (input.type() != type()) {
            throw new InvalidRequestException("type", "An account's type can't be changed after it is created.");
        }
        rejectForeignProfiles(input);
        this.name = requiredText("name", input.name());
        this.website = optional(input.website());
        this.phone = optional(input.phone());
        this.industry = optional(input.industry());
        this.employeeCount = nonNegative("employeeCount", input.employeeCount());
        this.annualRevenue = nonNegative("annualRevenue", input.annualRevenue());
        this.billingAddress = Address.orEmpty(input.billingAddress());
        this.shippingAddress = Address.orEmpty(input.shippingAddress());
        this.ownerId = ownerId;
        applyProfile(input);
    }

    public abstract AccountType type();

    /** How important the account is, decided by each subtype from its own attributes. */
    public abstract AccountTier tier();

    /** The support entitlement that comes with this kind of account. */
    public abstract SupportLevel supportLevel();

    /** Copies the subtype's own profile from the input (missing profile = defaults). */
    protected abstract void applyProfile(AccountInput input);

    /** Subtype attributes, for audit diffs. */
    protected abstract Map<String, Object> profileSnapshot();

    public void archive() {
        if (archivedAt != null) {
            throw new InvalidRequestException("This account is already archived.");
        }
        archivedAt = Instant.now();
    }

    public void restore() {
        if (archivedAt == null) {
            throw new InvalidRequestException("This account isn't archived.");
        }
        archivedAt = null;
    }

    public boolean isArchived() {
        return archivedAt != null;
    }

    public AccountSummary toSummary() {
        return new AccountSummary(getId(), number, name, type(), isArchived());
    }

    /** Every audited field, common and subtype, keyed by name. */
    public Map<String, Object> snapshot() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("name", name);
        values.put("website", website);
        values.put("phone", phone);
        values.put("industry", industry);
        values.put("employeeCount", employeeCount);
        values.put("annualRevenue", annualRevenue);
        values.put("billingAddress", getBillingAddress().isEmpty() ? null : getBillingAddress());
        values.put("shippingAddress", getShippingAddress().isEmpty() ? null : getShippingAddress());
        values.put("ownerId", ownerId);
        values.putAll(profileSnapshot());
        return values;
    }

    private void rejectForeignProfiles(AccountInput input) {
        if (type() != AccountType.ENTERPRISE && input.enterprise() != null) {
            throw new InvalidRequestException("enterprise", "Enterprise details only apply to enterprise accounts.");
        }
        if (type() != AccountType.SMB && input.smb() != null) {
            throw new InvalidRequestException("smb", "SMB details only apply to SMB accounts.");
        }
        if (type() != AccountType.STARTUP && input.startup() != null) {
            throw new InvalidRequestException("startup", "Startup details only apply to startup accounts.");
        }
    }

    public String getNumber() {
        return number;
    }

    public String getName() {
        return name;
    }

    public String getWebsite() {
        return website;
    }

    public String getPhone() {
        return phone;
    }

    public String getIndustry() {
        return industry;
    }

    public Integer getEmployeeCount() {
        return employeeCount;
    }

    public BigDecimal getAnnualRevenue() {
        return annualRevenue;
    }

    public Address getBillingAddress() {
        return Address.orEmpty(billingAddress);
    }

    public Address getShippingAddress() {
        return Address.orEmpty(shippingAddress);
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    static <T> T required(String field, T value) {
        if (value == null) {
            throw new InvalidRequestException(field, "This field is required.");
        }
        return value;
    }

    static String requiredText(String field, String value) {
        if (value == null || value.isBlank()) {
            throw new InvalidRequestException(field, "This field is required.");
        }
        return value.strip();
    }

    static String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    static Integer nonNegative(String field, Integer value) {
        if (value != null && value < 0) {
            throw new InvalidRequestException(field, "Must be zero or greater.");
        }
        return value;
    }

    static BigDecimal nonNegative(String field, BigDecimal value) {
        if (value != null && value.signum() < 0) {
            throw new InvalidRequestException(field, "Must be zero or greater.");
        }
        return value;
    }
}
