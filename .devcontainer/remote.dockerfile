FROM node:18-bullseye

ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

RUN apt install -y curl git vim

# RUN wget -O- https://aka.ms/install-vscode-server/setup.sh | sh
RUN cd /tmp \
    && curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --output vscode_cli.tar.gz \
    && tar -xf vscode_cli.tar.gz \
    && mv code /usr/local/bin/

USER $USERNAME
ENV SHELL=/bin/bash

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -

# CMD ["code-server", "serve", "--accept-server-license-terms", "--random-name", "--server-data-dir", "/workspace/.vscode-server"]
CMD ["code", "tunnel", "--accept-server-license-terms", "--random-name", "--cli-data-dir", "/workspace/.vscode-server"]
