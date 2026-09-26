package com.parallaxcrm.shared.paging;

import com.parallaxcrm.shared.error.InvalidRequestException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Builds a {@link Pageable} from raw query parameters, capping the page size and accepting only
 * whitelisted sort fields so clients cannot sort on arbitrary (or non-existent) properties.
 */
public final class PageRequests {

    public static final int MAX_PAGE_SIZE = 100;

    private PageRequests() {
    }

    /**
     * @param sort "field" or "field,asc|desc"; null or blank uses {@code defaultSort}
     */
    public static Pageable of(int page, int size, String sort, Set<String> sortableFields, Sort defaultSort) {
        if (page < 0) {
            throw new InvalidRequestException("page", "Page must be zero or greater.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("size", "Page size must be between 1 and " + MAX_PAGE_SIZE + ".");
        }
        return PageRequest.of(page, size, parseSort(sort, sortableFields, defaultSort));
    }

    private static Sort parseSort(String sort, Set<String> sortableFields, Sort defaultSort) {
        if (sort == null || sort.isBlank()) {
            return defaultSort;
        }
        String[] parts = sort.split(",");
        String field = parts[0].trim();
        if (!sortableFields.contains(field) || parts.length > 2) {
            throw new InvalidRequestException("sort", "Cannot sort by '%s'.".formatted(sort));
        }
        Sort.Direction direction = Sort.Direction.ASC;
        if (parts.length == 2) {
            direction = Sort.Direction.fromOptionalString(parts[1].trim())
                    .orElseThrow(() -> new InvalidRequestException("sort", "Sort direction must be 'asc' or 'desc'."));
        }
        // Tie-break on id so paging is stable when the sort field has duplicates.
        return Sort.by(direction, field).and(Sort.by("id"));
    }
}
