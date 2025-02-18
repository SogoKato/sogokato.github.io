FROM node:18-bullseye

ARG USERNAME=code
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid ${USER_GID} ${USERNAME} \
    && useradd --uid ${USER_UID} --gid ${USER_GID} -m ${USERNAME} \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

RUN apt install -y curl git tig vim

# RUN wget -O- https://aka.ms/install-vscode-server/setup.sh | sh
RUN cd /tmp \
    && curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --output vscode_cli.tar.gz \
    && tar -xf vscode_cli.tar.gz \
    && mv code /usr/local/bin/

USER $USERNAME
ENV SHELL=/bin/bash

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -

CMD ["code", "tunnel", "--accept-server-license-terms", "--random-name", "--cli-data-dir", "/home/code/workspace/.vscode-server"]
