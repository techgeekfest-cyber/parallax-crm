package com.parallaxcrm.shared.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ChangeSetTests {

    @Test
    void recordsOnlyFieldsThatChanged() {
        Map<String, Object> before = new HashMap<>(Map.of("name", "Acme", "industry", "Retail"));
        Map<String, Object> after = new HashMap<>(Map.of("name", "Acme", "industry", "Logistics"));

        var changes = new ChangeSet().diff(before, after).asMap();

        assertThat(changes).containsOnlyKeys("industry");
        assertThat(changes.get("industry")).isEqualTo(Map.of("from", "Retail", "to", "Logistics"));
    }

    @Test
    void numbersThatDifferOnlyInScaleAreUnchanged() {
        assertThat(new ChangeSet().track("amount", new BigDecimal("100"), new BigDecimal("100.00")).isEmpty()).isTrue();
    }

    @Test
    void fieldsAppearingOrDisappearingAreChanges() {
        Map<String, Object> before = new HashMap<>();
        before.put("phone", null);
        var changes = new ChangeSet().diff(before, Map.of("phone", "+1 555 0100"));
        assertThat(changes.contains("phone")).isTrue();
    }
}
