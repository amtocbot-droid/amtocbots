FROM alpine:3.20 AS downloader
ARG MAGIC_LINK_VERSION=0.57
RUN wget -qO /keycloak-magic-link.jar \
    "https://repo1.maven.org/maven2/io/phasetwo/keycloak/keycloak-magic-link/${MAGIC_LINK_VERSION}/keycloak-magic-link-${MAGIC_LINK_VERSION}.jar"

FROM quay.io/keycloak/keycloak:26.2 AS builder
COPY --from=downloader /keycloak-magic-link.jar /opt/keycloak/providers/keycloak-magic-link.jar
RUN /opt/keycloak/bin/kc.sh build \
    --db=postgres \
    --health-enabled=true \
    --features=passkeys

FROM quay.io/keycloak/keycloak:26.2
COPY --from=builder /opt/keycloak /opt/keycloak
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
