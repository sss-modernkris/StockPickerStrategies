# This Dockerfile is based on the reference project's ibgw.Dockerfile

FROM ubuntu:22.04 as setup

ENV IB_GATEWAY_VERSION=10.44.1g
ENV IB_GATEWAY_RELEASE_CHANNEL=latest
ENV IBC_VERSION=3.23.0

# Prepare system
RUN apt-get update -y && apt-get install --no-install-recommends --yes \
  curl \
  ca-certificates \
  unzip

WORKDIR /tmp/setup

# Install IB Gateway
RUN curl -sSL https://download2.interactivebrokers.com/installers/ibgateway/latest-standalone/ibgateway-latest-standalone-linux-x64.sh --output ibgateway-latest-standalone-linux-x64.sh
RUN chmod a+x ./ibgateway-latest-standalone-linux-x64.sh
RUN ./ibgateway-latest-standalone-linux-x64.sh -q -dir /root/Jts/ibgateway/${IB_GATEWAY_VERSION}

# Copy configuration files (relative to build context)
COPY ./config/ibgateway/jts.ini /root/Jts/jts.ini

# Install IBC
RUN curl -sSL https://github.com/IbcAlpha/IBC/releases/download/${IBC_VERSION}/IBCLinux-${IBC_VERSION}.zip --output IBCLinux-${IBC_VERSION}.zip
RUN mkdir /root/ibc
RUN unzip ./IBCLinux-${IBC_VERSION}.zip -d /root/ibc
RUN chmod -R u+x /root/ibc/*.sh 
RUN chmod -R u+x /root/ibc/scripts/*.sh

COPY ./config/ibc/config.ini.tmpl /root/ibc/config.ini.tmpl
COPY ./scripts /root/scripts

#
# Build Stage: build production image
#

FROM ubuntu:22.04

ENV IB_GATEWAY_VERSION=10.44.1g

WORKDIR /root

# Prepare system
RUN apt-get update -y && apt-get install --no-install-recommends --yes \
  gettext \
  xvfb \
  libxslt-dev \
  libxrender1 \
  libxtst6 \
  libxi6 \
  libgtk2.0-bin \
  socat \
  x11vnc

# Copy files from setup stage
COPY --from=setup /root/ .
RUN chmod a+x /root/scripts/*.sh
COPY --from=setup /usr/local/i4j_jres/ /usr/local/i4j_jres

# IBC env vars
ENV TWS_MAJOR_VRSN ${IB_GATEWAY_VERSION}
ENV TWS_PATH /root/Jts
ENV IBC_PATH /root/ibc
ENV IBC_INI /root/ibc/config.ini
ENV TWOFA_TIMEOUT_ACTION exit

# Resolve java.lang.reflect.InaccessibleObjectException for IB Gateway 10.x
ENV JAVA_TOOL_OPTIONS="--add-opens=java.desktop/javax.swing=ALL-UNNAMED --add-opens=java.desktop/javax.swing.border=ALL-UNNAMED --add-opens=java.desktop/javax.swing.plaf.basic=ALL-UNNAMED --add-opens=java.desktop/java.awt=ALL-UNNAMED --add-opens=java.desktop/sun.awt=ALL-UNNAMED"

# Expose ports for Paper Trading and Live Trading
EXPOSE 4001 4002 5900 7497 7496

# Start run script
CMD ["/root/scripts/run.sh"]
