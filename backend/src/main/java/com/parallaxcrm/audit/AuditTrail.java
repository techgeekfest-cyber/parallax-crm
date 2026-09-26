package com.parallaxcrm.audit;

import com.parallaxcrm.audit.internal.AuditEvent;
import com.parallaxcrm.audit.internal.AuditEventRepository;
import com.parallaxcrm.shared.security.Actors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

/**
 * Public API of the audit module. Callers must already be inside a transaction, so the audit row commits or rolls
 * back together with the change it records.
 */
@Service
public class AuditTrail {

    private final AuditEventRepository events;
    private final JsonMapper json;

    AuditTrail(AuditEventRepository events, JsonMapper json) {
        this.events = events;
        this.json = json;
    }

    /**
     * @param entityType a stable record type name, e.g. {@code "Lead"}
     * @param changes    what changed; for {@link AuditAction#CREATE} the initial field values
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuditAction action, String entityType, UUID entityId, Map<String, ?> changes) {
        // No signed-in actor means a system change (e.g. the initial admin bootstrap).
        UUID actorId = Actors.currentActorId().orElse(null);
        events.save(new AuditEvent(entityType, entityId, action.name(), actorId, json.writeValueAsString(changes)));
    }
}
