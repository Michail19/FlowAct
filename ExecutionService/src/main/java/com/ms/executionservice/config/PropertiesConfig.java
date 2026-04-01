package com.ms.executionservice.config;

import com.ms.executionservice.config.properties.FlowActExecutionProperties;
import com.ms.executionservice.config.properties.FlowActHttpProperties;
import com.ms.executionservice.config.properties.FlowActServiceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        FlowActServiceProperties.class,
        FlowActHttpProperties.class,
        FlowActExecutionProperties.class
})
public class PropertiesConfig {
}
