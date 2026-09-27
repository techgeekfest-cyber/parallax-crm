package com.parallaxcrm.salesteam;

import com.parallaxcrm.identity.DirectoryEntry;
import com.parallaxcrm.identity.Role;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SalesRepTests {

    @Test
    void attainmentIsYtdSalesOverQuota() {
        assertThat(rep("200000", "50000").attainmentPercent()).isEqualByComparingTo("25.0");
        assertThat(rep("80000", "100000").attainmentPercent()).isEqualByComparingTo("125.0");
    }

    @Test
    void attainmentIsUndefinedWithoutAQuota() {
        assertThat(rep("0", "50000").attainmentPercent()).isNull();
    }

    private static SalesRep rep(String quota, String ytd) {
        var user = new DirectoryEntry(UUID.randomUUID(), "r@example.com", "Rae", "Rep", Role.SALES_REP, true);
        return new SalesRep(user, null, null, null, null, new BigDecimal(quota), 0, 0, 0, 0, BigDecimal.ZERO,
                BigDecimal.ZERO, new BigDecimal(ytd));
    }
}
