FROM quay.io/keycloak/keycloak:26 AS builder

# Download the magic-link extension (p2-inc/keycloak-magic-link)
# Check https://github.com/p2-inc/keycloak-magic-link/releases for latest version
ARG MAGIC_LINK_VERSION=2.1.0
ADD https://github.com/p2-inc/keycloak-magic-link/releases/download/${MAGIC_LINK_VERSION}/keycloak-magic-link-${MAGIC_LINK_VERSION}.jar \
    /opt/keycloak/providers/keycloak-magic-link.jar

# Build optimized Keycloak image
RUN /opt/keycloak/bin/kc.sh build \
    --db=postgres \
    --health-enabled=true \
    --features=passkeys,magic-link

FROM quay.io/keycloak/keycloak:26
COPY --from=builder /opt/keycloak /opt/keycloak

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
