package com.parallaxcrm.support;

import com.parallaxcrm.identity.internal.UserRepository;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

@TestConfiguration(proxyBeanMethods = false)
public class TestSupportConfiguration {

    @Bean
    TestUsers testUsers(UserRepository users, PasswordEncoder passwordEncoder) {
        return new TestUsers(users, passwordEncoder);
    }

    @Bean
    TestDatabase testDatabase(JdbcTemplate jdbc) {
        return new TestDatabase(jdbc);
    }
}
