FROM node:16-bullseye

ENV SHELL=/bin/bash

RUN apt update && \
    apt install curl git

USER node
ENV SHELL=/bin/bash

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -
