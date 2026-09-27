package com.parallaxcrm.shared.web;

import com.parallaxcrm.shared.domain.Address;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Address in requests and responses; every part is optional. */
public record AddressDto(
        @Nullable @Size(max = 255) String street,
        @Nullable @Size(max = 120) String city,
        @Nullable @Size(max = 120) String state,
        @Nullable @Size(max = 20) String postalCode,
        @Nullable @Size(max = 120) String country) {

    public Address toAddress() {
        return new Address(street, city, state, postalCode, country);
    }

    public static AddressDto from(Address address) {
        Address a = Address.orEmpty(address);
        return new AddressDto(a.street(), a.city(), a.state(), a.postalCode(), a.country());
    }

    public static Address toAddress(AddressDto dto) {
        return dto == null ? Address.EMPTY : dto.toAddress();
    }
}
