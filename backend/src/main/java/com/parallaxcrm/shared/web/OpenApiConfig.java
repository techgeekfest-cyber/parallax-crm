package com.parallaxcrm.shared.web;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class OpenApiConfig {

    @Bean
    OpenAPI parallaxOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("ParallaxCRM API")
                        .description("REST API for ParallaxCRM — Enterprise Customer Relationship Platform. "
                                + "Sign in with POST /api/v1/auth/login; write requests must echo the XSRF-TOKEN "
                                + "cookie in the X-XSRF-TOKEN header.")
                        .version("v1"))
                .components(new Components().addSecuritySchemes("session", new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.COOKIE)
                        .name("PARALLAX_SESSION")))
                .addSecurityItem(new SecurityRequirement().addList("session"));
    }
}
