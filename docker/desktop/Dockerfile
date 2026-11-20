FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Packages only. noVNC is Debian's MPL-2.0 build and is not modified or copied into the Roster Lab source tree.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-dejavu-core \
    novnc \
    openbox \
    procps \
    socat \
    websockify \
    x11vnc \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

COPY start.sh /usr/local/bin/start-desktop.sh
RUN chmod 755 /usr/local/bin/start-desktop.sh

EXPOSE 6080 9223
CMD ["/usr/local/bin/start-desktop.sh"]
