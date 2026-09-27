package com.parallaxcrm.activities;

import com.parallaxcrm.activities.internal.Activity;
import com.parallaxcrm.activities.internal.ActivityRepository;
import com.parallaxcrm.identity.CurrentUser;
import com.parallaxcrm.shared.error.InvalidRequestException;
import com.parallaxcrm.shared.security.Actors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

/**
 * Public API of the activities module: the timeline of every lead, account, contact and opportunity.
 *
 * <p>Workflows call {@link #record} inside their own transaction, so a stage change or conversion and its timeline
 * entry commit or roll back together. People add calls, emails, meetings and notes through {@link #log}, which checks
 * access to the target record through that module's {@link TimelineAccess}.
 */
@Service
@Transactional(readOnly = true)
public class ActivityLog {

    /** Tolerates clock differences between the browser and the server when someone logs something "just now". */
    private static final Duration CLOCK_SKEW = Duration.ofMinutes(5);

    private final ActivityRepository activities;
    private final CurrentUser currentUser;
    /*
     * Resolved on first use: the modules providing TimelineAccess also write activities through this service, so
     * eager injection would be a construction cycle.
     */
    private final ObjectProvider<TimelineAccess> timelineAccess;
    private volatile Map<ActivityTarget, TimelineAccess> access;

    ActivityLog(ActivityRepository activities, CurrentUser currentUser, ObjectProvider<TimelineAccess> timelineAccess) {
        this.activities = activities;
        this.currentUser = currentUser;
        this.timelineAccess = timelineAccess;
    }

    /** Records a system activity as part of the caller's transaction. The actor is the signed-in user, if any. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(ActivityType type, String subject, String body, ActivityLinks links) {
        activities.save(new Activity(type, subject, body, Actors.currentActorId().orElse(null), null, links));
    }

    /** Logs a call, email, meeting or note by the signed-in user against one record they can work on. */
    @Transactional
    public Activity log(NewActivity input) {
        UUID actorId = currentUser.require().id();
        if (input.type() == null || !input.type().isManual()) {
            throw new InvalidRequestException("type", "Choose a call, email, meeting or note.");
        }
        if (input.occurredAt() != null && input.occurredAt().isAfter(Instant.now().plus(CLOCK_SKEW))) {
            throw new InvalidRequestException("occurredAt", "An activity can't be logged in the future.");
        }
        accessFor(input.target()).requireCanLog(input.targetId());
        return activities.saveAndFlush(new Activity(input.type(), input.subject(), input.body(), actorId,
                input.occurredAt(), ActivityLinks.to(input.target(), input.targetId())));
    }

    /** The record's timeline, newest first. Visible to exactly the people who can open the record. */
    public Page<Activity> timeline(ActivityTarget target, UUID recordId, Pageable pageable) {
        currentUser.require();
        accessFor(target).requireCanView(recordId);
        return switch (target) {
            case LEAD -> activities.findByLeadId(recordId, pageable);
            case ACCOUNT -> activities.findByAccountId(recordId, pageable);
            case CONTACT -> activities.findByContactId(recordId, pageable);
            case OPPORTUNITY -> activities.findByOpportunityId(recordId, pageable);
        };
    }

    private TimelineAccess accessFor(ActivityTarget target) {
        if (target == null) {
            throw new InvalidRequestException("Choose the record the activity belongs to.");
        }
        TimelineAccess found = accessByTarget().get(target);
        if (found == null) {
            throw new IllegalStateException("No TimelineAccess registered for " + target);
        }
        return found;
    }

    private Map<ActivityTarget, TimelineAccess> accessByTarget() {
        Map<ActivityTarget, TimelineAccess> resolved = access;
        if (resolved == null) {
            resolved = new EnumMap<>(ActivityTarget.class);
            for (TimelineAccess each : timelineAccess) {
                if (resolved.put(each.target(), each) != null) {
                    throw new IllegalStateException("More than one TimelineAccess for " + each.target());
                }
            }
            access = resolved;
        }
        return resolved;
    }
}
