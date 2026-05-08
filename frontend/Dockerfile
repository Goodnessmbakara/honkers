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

# Vite dev server listens on all interfaces
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
