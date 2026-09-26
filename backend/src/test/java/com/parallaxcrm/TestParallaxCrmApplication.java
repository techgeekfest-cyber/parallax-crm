package com.parallaxcrm;

import org.springframework.boot.SpringApplication;

/** Runs the application against a throwaway Testcontainers PostgreSQL: {@code ./mvnw spring-boot:test-run}. */
public class TestParallaxCrmApplication {

    public static void main(String[] args) {
        SpringApplication.from(ParallaxCrmApplication::main).with(TestcontainersConfiguration.class).run(args);
    }
}
