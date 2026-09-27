package com.parallaxcrm.opportunities.web;

import java.util.List;

/** The Kanban board: one column per stage in pipeline order, and totals over every column. */
public record PipelineResponse(List<PipelineColumnResponse> columns, PipelineSummaryResponse totals) {
}
