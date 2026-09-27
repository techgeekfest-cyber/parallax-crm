package com.parallaxcrm.activities.web;

import com.parallaxcrm.activities.ActivityLog;
import com.parallaxcrm.activities.internal.Activity;
import com.parallaxcrm.identity.UserDirectory;
import com.parallaxcrm.shared.paging.PageRequests;
import com.parallaxcrm.shared.paging.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/activities")
@Tag(name = "Activities")
class ActivityController {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "occurredAt").and(Sort.by(Sort.Direction.DESC, "id"));

    private final ActivityLog activities;
    private final UserDirectory users;

    ActivityController(ActivityLog activities, UserDirectory users) {
        this.activities = activities;
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "A record's activity timeline",
            description = "Newest first. Give exactly one of leadId, accountId, contactId or opportunityId; you see the "
                    + "timeline of any record you can open.")
    PageResponse<ActivityResponse> timeline(
            @RequestParam(required = false) UUID leadId,
            @RequestParam(required = false) UUID accountId,
            @RequestParam(required = false) UUID contactId,
            @RequestParam(required = false) UUID opportunityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        var target = ActivityRequest.TargetRef.exactlyOne(leadId, accountId, contactId, opportunityId);
        Page<Activity> result = activities.timeline(target.target(), target.id(),
                PageRequests.of(page, size, null, Set.of(), NEWEST_FIRST));
        var actors = users.summaries(result.map(Activity::getActorId).getContent());
        return PageResponse.of(result, activity -> ActivityResponse.from(activity, actors.get(activity.getActorId())));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Log a call, email, meeting or note",
            description = "On a lead or opportunity you can work on, or on any active account or contact.")
    ActivityResponse log(@Valid @RequestBody ActivityRequest request) {
        Activity activity = activities.log(request.toNewActivity());
        var actor = users.summaries(List.of(activity.getActorId())).get(activity.getActorId());
        return ActivityResponse.from(activity, actor);
    }
}
