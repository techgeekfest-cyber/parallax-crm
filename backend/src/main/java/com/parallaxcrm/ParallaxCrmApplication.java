package com.parallaxcrm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// Sign-in is handled by the identity module against the users table; Boot's default in-memory user must not exist.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class ParallaxCrmApplication {

    public static void main(String[] args) {
        SpringApplication.run(ParallaxCrmApplication.class, args);
    }

}
