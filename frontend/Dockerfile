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
# Vite dev server listens on all interfaces
# --force is intentionally omitted: Vite will use the cache built during `docker build`
# and only re-optimize if deps change. Adding --force causes it to re-run on every
# container start, blocking ALL requests during optimization → 504s at the ALB.
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
