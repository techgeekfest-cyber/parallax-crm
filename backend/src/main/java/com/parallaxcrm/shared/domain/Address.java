package com.parallaxcrm.shared.domain;

import jakarta.persistence.Embeddable;

/**
 * A postal address value object, embedded into owning tables as {@code <prefix>_street}, {@code <prefix>_city}, …
 * All parts are optional; blank parts are stored as null.
 */
@Embeddable
public record Address(String street, String city, String state, String postalCode, String country) {

    public static final Address EMPTY = new Address(null, null, null, null, null);

    public Address {
        street = clean(street);
        city = clean(city);
        state = clean(state);
        postalCode = clean(postalCode);
        country = clean(country);
    }

    public static Address orEmpty(Address address) {
        return address == null ? EMPTY : address;
    }

    public boolean isEmpty() {
        return street == null && city == null && state == null && postalCode == null && country == null;
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
