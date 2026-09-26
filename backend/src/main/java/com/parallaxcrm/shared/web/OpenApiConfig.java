package com.parallaxcrm.shared.web;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class OpenApiConfig {

    @Bean
    OpenAPI parallaxOpenApi() {
        return new OpenAPI().info(new Info()
                .title("ParallaxCRM API")
                .description("REST API for ParallaxCRM — Enterprise Customer Relationship Platform")
                .version("v1"));
    }
}
