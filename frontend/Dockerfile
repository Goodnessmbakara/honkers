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

# Avoid node_modules/.vite (pnpm + overlay can EXDEV on deps rename). Do NOT use /tmp — Vite then serves
# deps as /@fs/tmp/... which is outside fs.allow (only /app is allowed) → hung requests → 504 at ALB.
ENV HONKERS_VITE_CACHE_DIR=/app/frontend/.vite-cache

# Pre-build the Vite dep cache so cold starts never block requests.
# WITHOUT --force: Vite uses this cache as long as pnpm-lock.yaml and
# optimizeDeps config match — zero blocking on container start.
# WITH --force: cache is invalidated on every start, re-optimization runs,
# blocking ALL requests and causing 504s at the ALB.
RUN VITE_AZTEC_RPC_URL=/rpc \
    VITE_ADMIN_ADDRESSES=0x1092539b9d20142398c8a8f3e9b0462f1d38cddd587c94b7bc80ff47e6a0b51a \
    VITE_USDH_ADDRESS=0x14913c13aa09a37f18290ffe69a6c9b6a49cebd7e94b909f6c38a8324d2d11c3 \
    VITE_AMM_ADDRESS=0x0804e1da83c1c2cc473f26c9cd74cc3dfdbeed0e663813d5cfdf28cea6062732 \
    VITE_ORACLE_ADDRESS=0x29e13066f73f7da9fbdbf3ac0870607a2bc21bcf00bd20cec35d141f025a2c92 \
    VITE_PRIVATE_VAULT_ADDRESS=0x303913f82417065658b5a8687317cb83ce3b46c4ecc52d4f1ff1004444a1f128 \
    VITE_MARKET_FACTORY_ADDRESS=0x243d77c08c93f5e7d4f40c384feb39130b3a85d20c21c9a88fc69aa503bd3cfb \
    pnpm vite optimize

# Vite dev server listens on all interfaces
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
