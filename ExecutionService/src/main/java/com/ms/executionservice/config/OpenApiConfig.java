package com.ms.executionservice.config;

import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI executionServiceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("FlowAct Execution Service API")
                        .version("1.0.0")
                        .description("API сервиса исполнения рабочих процессов FlowAct")
                        .contact(new Contact().name("Mikhail Ershov"))
                        .license(new License().name("Internal / Educational use")))
                .externalDocs(new ExternalDocumentation()
                        .description("FlowAct docs"));
    }
}
