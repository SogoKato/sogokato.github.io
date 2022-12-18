FROM node:16-bullseye

ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

RUN apt update && \
    apt install curl git

USER $USERNAME
ENV SHELL=/bin/bash

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -
