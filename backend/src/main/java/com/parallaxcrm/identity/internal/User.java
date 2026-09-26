package com.parallaxcrm.identity.internal;

import com.parallaxcrm.identity.AuthenticatedUser;
import com.parallaxcrm.identity.Role;
import com.parallaxcrm.identity.UserSummary;
import com.parallaxcrm.shared.domain.AbstractEntity;
import com.parallaxcrm.shared.error.InvalidRequestException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Locale;

/** A person who can sign in. The password hash never leaves this class except for verification. */
@Entity
@Table(name = "users")
public class User extends AbstractEntity {

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected User() {
        // for JPA
    }

    public static User create(String email, String firstName, String lastName, Role role, String passwordHash) {
        User user = new User();
        user.email = normaliseEmail(email);
        user.rename(firstName, lastName);
        user.role = requireRole(role);
        user.passwordHash = passwordHash;
        user.active = true;
        return user;
    }

    public static String normaliseEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new InvalidRequestException("email", "This field is required.");
        }
        return email.strip().toLowerCase(Locale.ROOT);
    }

    public void rename(String firstName, String lastName) {
        this.firstName = required("firstName", firstName);
        this.lastName = required("lastName", lastName);
    }

    public void changeRole(Role role) {
        this.role = requireRole(role);
    }

    public void activate() {
        this.active = true;
    }

    public void deactivate() {
        this.active = false;
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public AuthenticatedUser toAuthenticatedUser() {
        return new AuthenticatedUser(getId(), email, firstName, lastName, role);
    }

    public UserSummary toSummary() {
        return new UserSummary(getId(), fullName(), role, active);
    }

    public String fullName() {
        return firstName + " " + lastName;
    }

    public String getEmail() {
        return email;
    }

    String getPasswordHash() {
        return passwordHash;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public Role getRole() {
        return role;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    private static Role requireRole(Role role) {
        if (role == null) {
            throw new InvalidRequestException("role", "Choose a role.");
        }
        return role;
    }

    private static String required(String field, String value) {
        if (value == null || value.isBlank()) {
            throw new InvalidRequestException(field, "This field is required.");
        }
        return value.strip();
    }
}
