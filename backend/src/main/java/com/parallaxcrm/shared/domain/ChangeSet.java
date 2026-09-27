package com.parallaxcrm.shared.domain;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Collects field-level {@code {from, to}} changes for the audit trail. Unchanged fields are skipped, so an update
 * that changes nothing produces an empty change set (and no audit row).
 */
public final class ChangeSet {

    private final Map<String, Object> changes = new LinkedHashMap<>();

    public ChangeSet track(String field, Object from, Object to) {
        if (!equivalent(from, to)) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("from", from);
            change.put("to", to);
            changes.put(field, change);
        }
        return this;
    }

    /** Tracks every field present in either snapshot. */
    public ChangeSet diff(Map<String, ?> before, Map<String, ?> after) {
        var fields = new java.util.LinkedHashSet<String>(before.keySet());
        fields.addAll(after.keySet());
        fields.forEach(field -> track(field, before.get(field), after.get(field)));
        return this;
    }

    public boolean isEmpty() {
        return changes.isEmpty();
    }

    public boolean contains(String field) {
        return changes.containsKey(field);
    }

    public Map<String, Object> asMap() {
        return changes;
    }

    /** BigDecimal equality ignores scale (100 == 100.00), matching how values are shown to users. */
    private static boolean equivalent(Object from, Object to) {
        if (from instanceof java.math.BigDecimal a && to instanceof java.math.BigDecimal b) {
            return a.compareTo(b) == 0;
        }
        return Objects.equals(from, to);
    }
}
