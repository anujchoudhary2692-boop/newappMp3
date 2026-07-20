# Multi-stage build: Maven compile + runtime with yt-dlp/ffmpeg
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update \
    && apt-get install -y --no-install-recommends yt-dlp ffmpeg python3 ca-certificates curl \
    && yt-dlp --update-to stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /build/target/media-face-backend-*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_OPTS="-Xmx1g -XX:+UseG1GC"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD sh -c 'curl -sf "http://localhost:${PORT:-8080}/api/live" || exit 1'

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
