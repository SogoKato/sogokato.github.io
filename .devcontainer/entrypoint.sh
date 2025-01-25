#!/bin/bash

if [ ! -e ${HOME}/workspace/certificates/cert.pem ] || [ ! -e ${HOME}/workspace/certificates/key.pem ]; then
	sudo curl -L "https://dl.filippo.io/mkcert/latest?for=linux/$(dpkg --print-architecture)" -o /usr/local/bin/mkcert
  sudo chmod +x /usr/local/bin/mkcert

  mkdir -p ${HOME}/workspace/certificates

  mkcert -install
  mkcert \
    -cert-file ${HOME}/workspace/certificates/cert.pem \
    -key-file ${HOME}/workspace/certificates/key.pem \
    "*.sogo.dev" localhost 127.0.0.1 ::1
fi

code tunnel \
  --accept-server-license-terms \
  --random-name \
  --cli-data-dir ${HOME}/workspace/.vscode-server
