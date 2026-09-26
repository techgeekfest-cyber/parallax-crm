package com.parallaxcrm.shared.paging;

import com.parallaxcrm.shared.error.InvalidRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PageRequestsTests {

    private static final Set<String> SORTABLE = Set.of("createdAt", "company");
    private static final Sort DEFAULT = Sort.by(Sort.Direction.DESC, "createdAt");

    @Test
    void usesDefaultSortWhenNoneRequested() {
        assertThat(PageRequests.of(0, 25, null, SORTABLE, DEFAULT).getSort()).isEqualTo(DEFAULT);
    }

    @Test
    void parsesWhitelistedSortWithDirectionAndStableTieBreak() {
        Sort sort = PageRequests.of(2, 10, "company,desc", SORTABLE, DEFAULT).getSort();
        assertThat(sort).containsExactly(Sort.Order.desc("company"), Sort.Order.asc("id"));
    }

    @Test
    void rejectsUnknownSortFields() {
        assertThatThrownBy(() -> PageRequests.of(0, 25, "passwordHash", SORTABLE, DEFAULT))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("sort");
    }

    @Test
    void capsPageSize() {
        assertThatThrownBy(() -> PageRequests.of(0, PageRequests.MAX_PAGE_SIZE + 1, null, SORTABLE, DEFAULT))
                .isInstanceOf(InvalidRequestException.class)
                .extracting("field").isEqualTo("size");
    }
}
