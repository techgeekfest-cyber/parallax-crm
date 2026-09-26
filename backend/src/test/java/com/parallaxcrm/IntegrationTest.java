package com.parallaxcrm;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import com.parallaxcrm.support.TestSupportConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Full application context against Testcontainers PostgreSQL. All integration tests share one context
 * (and therefore one container) through Spring's context cache. The {@code test} profile keeps local-only settings,
 * such as the development admin bootstrap, out of tests.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, TestSupportConfiguration.class})
@ActiveProfiles("test")
public @interface IntegrationTest {
}
