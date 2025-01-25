FROM node:22-bullseye

ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN id -g ${USER_GID} || groupadd --gid ${USER_GID} ${USERNAME} \
    && id -u ${USER_UID} || useradd --uid ${USER_UID} --gid ${USER_GID} -m ${USERNAME} \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

RUN apt install -y curl git tig vim

# RUN wget -O- https://aka.ms/install-vscode-server/setup.sh | sh
RUN cd /tmp \
    && ARCH=$(uname -m | sed -E 's/x86_64/x64/;s/aarch64/arm64/') \
    && curl -Lk "https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-${ARCH}" --output vscode_cli.tar.gz \
    && tar -xf vscode_cli.tar.gz \
    && mv code /usr/local/bin/

USER $USERNAME
ENV SHELL=/bin/bash

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -

COPY .devcontainer/entrypoint.sh /

CMD ["/entrypoint.sh"]
