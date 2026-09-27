package com.parallaxcrm.contacts.internal;

import com.parallaxcrm.contacts.ContactInput;
import com.parallaxcrm.shared.domain.AbstractEntity;
import com.parallaxcrm.shared.domain.Address;
import com.parallaxcrm.shared.error.InvalidRequestException;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "contacts")
public class Contact extends AbstractEntity {

    @Generated
    @Column(insertable = false, updatable = false)
    private String number;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    private String email;

    private String phone;

    private String title;

    private String department;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "street", column = @Column(name = "mailing_street")),
            @AttributeOverride(name = "city", column = @Column(name = "mailing_city")),
            @AttributeOverride(name = "state", column = @Column(name = "mailing_state")),
            @AttributeOverride(name = "postalCode", column = @Column(name = "mailing_postal_code")),
            @AttributeOverride(name = "country", column = @Column(name = "mailing_country"))})
    private Address mailingAddress;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Contact() {
        // for JPA
    }

    public static Contact create(ContactInput input, UUID ownerId) {
        Contact contact = new Contact();
        contact.update(input, ownerId);
        return contact;
    }

    public void update(ContactInput input, UUID ownerId) {
        if (input.accountId() == null) {
            throw new InvalidRequestException("accountId", "Choose an account.");
        }
        this.accountId = input.accountId();
        this.firstName = required("firstName", input.firstName());
        this.lastName = required("lastName", input.lastName());
        this.email = normaliseEmail(input.email());
        this.phone = optional(input.phone());
        this.title = optional(input.title());
        this.department = optional(input.department());
        this.primary = input.primary();
        this.mailingAddress = Address.orEmpty(input.mailingAddress());
        this.ownerId = ownerId;
    }

    public static String normaliseEmail(String email) {
        return email == null || email.isBlank() ? null : email.strip().toLowerCase(Locale.ROOT);
    }

    /** Another contact became the account's primary contact. */
    public void demoteFromPrimary() {
        this.primary = false;
    }

    /** Archived contacts give up primary status, so the account can name a new primary contact. */
    public void archive() {
        if (archivedAt != null) {
            throw new InvalidRequestException("This contact is already archived.");
        }
        archivedAt = Instant.now();
        primary = false;
    }

    public void restore() {
        if (archivedAt == null) {
            throw new InvalidRequestException("This contact isn't archived.");
        }
        archivedAt = null;
    }

    public boolean isArchived() {
        return archivedAt != null;
    }

    public String fullName() {
        return firstName + " " + lastName;
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("accountId", accountId);
        values.put("firstName", firstName);
        values.put("lastName", lastName);
        values.put("email", email);
        values.put("phone", phone);
        values.put("title", title);
        values.put("department", department);
        values.put("primary", primary);
        values.put("mailingAddress", getMailingAddress().isEmpty() ? null : getMailingAddress());
        values.put("ownerId", ownerId);
        return values;
    }

    public String getNumber() {
        return number;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getTitle() {
        return title;
    }

    public String getDepartment() {
        return department;
    }

    public boolean isPrimary() {
        return primary;
    }

    public Address getMailingAddress() {
        return Address.orEmpty(mailingAddress);
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    private static String required(String field, String value) {
        if (value == null || value.isBlank()) {
            throw new InvalidRequestException(field, "This field is required.");
        }
        return value.strip();
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
