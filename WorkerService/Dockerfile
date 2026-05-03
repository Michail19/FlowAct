FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle

RUN chmod +x ./gradlew
RUN ./gradlew --no-daemon dependencies

COPY src ./src
RUN ./gradlew --no-daemon clean bootJar -x test

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S flowact \
    && adduser -S flowact -G flowact

COPY --from=build /app/build/libs/*.jar app.jar

USER flowact

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
