package com.parallaxcrm.shared.error;

/**
 * A business action that is well-formed but not allowed from the record's current state — an opportunity stage jump
 * the pipeline doesn't permit, or converting a lead twice. Returned as {@code 409} with a specific code so the UI can
 * explain what happened.
 */
public class WorkflowRuleException extends ParallaxException {

    private WorkflowRuleException(ErrorCode code, String message) {
        super(code, message);
    }

    public static WorkflowRuleException invalidTransition(String message) {
        return new WorkflowRuleException(ErrorCode.INVALID_STATE_TRANSITION, message);
    }

    public static WorkflowRuleException alreadyConverted(String message) {
        return new WorkflowRuleException(ErrorCode.ALREADY_CONVERTED, message);
    }
}
