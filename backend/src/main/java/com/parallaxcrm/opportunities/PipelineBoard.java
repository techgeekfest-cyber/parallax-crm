package com.parallaxcrm.opportunities;

import com.parallaxcrm.opportunities.internal.Opportunity;

import java.math.BigDecimal;
import java.util.List;

/**
 * The Kanban view of the pipeline: one column per stage in pipeline order. Counts and amounts cover every matching
 * opportunity in the stage; {@code opportunities} holds the first page of cards.
 */
public record PipelineBoard(List<Column> columns, PipelineSummary totals) {

    public record Column(OpportunityStage stage, long count, BigDecimal amount, BigDecimal weightedAmount,
            List<Opportunity> opportunities) {
    }
}
