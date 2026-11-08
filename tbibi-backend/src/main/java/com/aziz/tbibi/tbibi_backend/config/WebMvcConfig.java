package com.aziz.tbibi.tbibi_backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    // Serves files from the local uploads/ folder as HTTP resources.
    // Example: uploads/avatars/user_1.jpg
    //       → http://localhost:8084/uploads/avatars/user_1.jpg
    // This URL is stored in avatarUrl and loaded directly by the browser.
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/");
    }
}
