package com.ms.workerservice.config;

import com.ms.workerservice.config.properties.MlServiceProperties;
import com.ms.workerservice.config.properties.OpenRouterProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        MlServiceProperties.class,
        OpenRouterProperties.class
})
public class PropertiesConfig {
}
