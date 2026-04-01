package com.ms.executionservice.config;

import com.ms.executionservice.config.properties.FlowActHttpProperties;
import org.springframework.boot.web.client.ClientHttpRequestFactoryBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.ClientHttpRequestFactory;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean
    public ClientHttpRequestFactory clientHttpRequestFactory(FlowActHttpProperties httpProperties) {
        return ClientHttpRequestFactoryBuilder.simple()
                .withConnectTimeout(Duration.ofMillis(httpProperties.connectTimeout()))
                .withReadTimeout(Duration.ofMillis(httpProperties.readTimeout()))
                .build();
    }

    @Bean
    public RestClient.Builder restClientBuilder(ClientHttpRequestFactory requestFactory) {
        return RestClient.builder()
                .requestFactory(requestFactory);
    }
}
