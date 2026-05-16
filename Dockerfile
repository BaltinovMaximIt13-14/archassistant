FROM gradle:8.13-jdk21 AS builder
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon -x test
RUN ls -la build/libs/

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
CMD ["java", "-Dspring.profiles.active=docker", "-jar", "app.jar"]