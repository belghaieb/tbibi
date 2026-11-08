# TBIBI - Virtual Clinic Project

TBIBI is a virtual clinic management platform for patients, doctors, and admins.

## Project structure

```text
Tbibi votre clinic virtuelle/
├── README.md
├── .gitignore
├── front/                     # Frontend app (HTML/CSS/JS)
│   ├── assets/
│   ├── css/
│   ├── html/
│   └── js/
├── tbibi-backend/             # Spring Boot backend
│   ├── src/
│   ├── secrets/
│   ├── pom.xml
│   └── mvnw
├── resources/
│   ├── reports/               # Final report and other project documents
│   ├── presentations/        # Final presentation files
│   ├── videos/               # Demo videos
│   └── diagrams/             # Optional diagrams and design assets
└── archives/                 # excluded from the repo on purpose
```

## What is included in the repository

This repository keeps only the files needed to run or present the project:

- frontend app in `front/`
- backend app in `tbibi-backend/`
- project documents and media in `resources/`
- project README and repo-level configuration at the root

Legacy or duplicate folders such as `archives/`, `copie de backend/`, generated build artifacts, and oversized temporary files are excluded from the repository.

## Run the backend

Requirements:

- Java 21+
- MySQL server running locally
- database named `tbibi`
- local secrets file: `tbibi-backend/secrets/application-secrets.properties`

From the project root:

```powershell
cd tbibi-backend
./mvnw.cmd spring-boot:run
```

The backend is expected to run on:

- http://localhost:8084/api

## Run the frontend

Open the frontend entry pages from:

- `front/html/index.html`
- `front/html/login.html`
- `front/html/main.html`

The frontend expects the backend at `http://localhost:8084/api`.

## Resources

The project documentation and presentation materials are stored in:

- `resources/reports/`
- `resources/presentations/`
- `resources/videos/`

## Local configuration

Sensitive values are not committed.

- versioned sample config: `tbibi-backend/secrets/application-secrets.example.properties`
- local secrets file: `tbibi-backend/secrets/application-secrets.properties`

Copy the example file and fill in your local values before starting the backend.
