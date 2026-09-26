package com.parallaxcrm;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

/** Fails the build when a module reaches into another module's internals or modules form a cycle (ADR 0001). */
class ModularityTests {

    @Test
    void moduleBoundariesAreRespected() {
        ApplicationModules.of(ParallaxCrmApplication.class).verify();
    }
}
