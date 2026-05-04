FROM gradle:8.13-jdk21
WORKDIR /app
COPY src src
COPY build.gradle settings.gradle ./
RUN gradle bootJar --no-daemon -x test
RUN ls -la build/libs/
EXPOSE 8080
CMD ["java", "-jar", "build/libs/arh-1.0.0.jar"]