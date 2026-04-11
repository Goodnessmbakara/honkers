FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY . .

# Run migration then start
CMD ["sh", "-c", "pnpm db:migrate && pnpm dev"]
