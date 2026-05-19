# Honkers frontend — production: `pnpm build` + nginx (no Vite dev).
# Docker overlay + pnpm causes EXDEV on Vite optimizeDeps rename; static assets avoid that entirely.

FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10

COPY contracts/target/ /app/contracts/target/

COPY frontend/package.json frontend/pnpm-lock.yaml* ./frontend/
WORKDIR /app/frontend
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY frontend/ ./

ARG VITE_AZTEC_RPC_URL=/rpc
ARG VITE_MARKET_FACTORY_ADDRESS=
ARG VITE_AMM_ADDRESS=
ARG VITE_ORACLE_ADDRESS=
ARG VITE_USDH_ADDRESS=
ARG VITE_PRIVATE_VAULT_ADDRESS=
ARG VITE_ADMIN_ADDRESSES=
ARG VITE_SPONSORED_FPC_ADDRESS=
ARG VITE_FEE_RECIPIENT_ADDRESS=

ENV VITE_AZTEC_RPC_URL=$VITE_AZTEC_RPC_URL \
    VITE_MARKET_FACTORY_ADDRESS=$VITE_MARKET_FACTORY_ADDRESS \
    VITE_AMM_ADDRESS=$VITE_AMM_ADDRESS \
    VITE_ORACLE_ADDRESS=$VITE_ORACLE_ADDRESS \
    VITE_USDH_ADDRESS=$VITE_USDH_ADDRESS \
    VITE_PRIVATE_VAULT_ADDRESS=$VITE_PRIVATE_VAULT_ADDRESS \
    VITE_ADMIN_ADDRESSES=$VITE_ADMIN_ADDRESSES \
    VITE_SPONSORED_FPC_ADDRESS=$VITE_SPONSORED_FPC_ADDRESS \
    VITE_FEE_RECIPIENT_ADDRESS=$VITE_FEE_RECIPIENT_ADDRESS

RUN pnpm build

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
RUN mkdir -p /templates
COPY frontend/nginx-default.conf.template /templates/nginx-default.conf.template
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/docker-entrypoint.sh"]
