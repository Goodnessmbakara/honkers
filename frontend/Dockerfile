FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@10

# Copy workspace root for symlink resolution
COPY contracts/target/ /app/contracts/target/

# Install frontend deps
COPY frontend/package.json frontend/pnpm-lock.yaml* ./frontend/
WORKDIR /app/frontend
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy frontend source (artifacts symlink resolves to /app/contracts/target)
COPY frontend/ ./

# Pre-build Vite dep cache at image build time so the first request is never
# blocked by dep optimization (which causes 504s at the ALB on cold start).
# We dummy-set VITE_* vars so config parsing doesn't fail during optimize.
RUN VITE_AZTEC_RPC_URL=/rpc \
    VITE_AMM_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000001 \
    VITE_ORACLE_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000001 \
    VITE_MARKET_FACTORY_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000001 \
    VITE_USDH_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000001 \
    VITE_PRIVATE_VAULT_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000001 \
    VITE_ADMIN_ADDRESSES=0x0000000000000000000000000000000000000000000000000000000000000001 \
    pnpm vite optimize --force 2>&1 | tail -5 || true

# Vite dev server listens on all interfaces
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
