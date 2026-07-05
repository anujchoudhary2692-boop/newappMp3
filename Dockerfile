# Stage 1 — React web app (same-origin API via relative /api paths)
FROM node:20-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ .
ENV VITE_API_URL=
RUN npm run build

# Stage 2 — Spring Boot backend + embedded SPA
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY backend/pom.xml .
COPY backend/src ./src
COPY --from=web /web/dist ./src/main/resources/static/
RUN mvn -B clean package -DskipTests

# Stage 3 — runtime
FROM eclipse-temurin:17-jre-jammy
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
        -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /build/target/media-face-backend-*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_OPTS="-Xmx512m -XX:+UseG1GC"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=15s --start-period=180s --retries=3 \
    CMD sh -c 'curl -sf "http://localhost:${PORT:-8080}/api/health" || exit 1'

ENTRYPOINT ["sh", "-c", "yt-dlp --update-to stable 2>/dev/null || true; java $JAVA_OPTS -jar app.jar"]
