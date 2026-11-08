package com.aziz.tbibi.tbibi_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class TbibiBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(TbibiBackendApplication.class, args);
	}

}
