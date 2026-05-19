#!/bin/sh
set -e
RPC_URL="${AZTEC_SANDBOX_URL:-https://rpc.testnet.aztec-labs.com}"
RPC_URL="${RPC_URL%/}"
RPC_HOST=$(printf '%s' "$RPC_URL" | sed -e 's|^https\{0,1\}://||' -e 's|/.*||')
sed -e "s|__RPC_ORIGIN__|${RPC_URL}|g" -e "s|__RPC_HOST__|${RPC_HOST}|g" \
  /templates/nginx-default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
