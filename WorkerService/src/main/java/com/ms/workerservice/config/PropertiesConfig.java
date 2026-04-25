package com.ms.workerservice.config;

import com.ms.workerservice.config.properties.MlServiceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        MlServiceProperties.class
})
public class PropertiesConfig {
}
