FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma client at build time
RUN npx prisma generate

# Storage + auth dirs
RUN mkdir -p /app/storage/audios /app/.baileys

CMD ["npx", "tsx", "src/index.ts"]
