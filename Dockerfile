FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY smth-shared ./smth-shared
WORKDIR /app/smth-shared
RUN npm ci --ignore-scripts
RUN npm run build

WORKDIR /app
COPY smth-back/package*.json ./smth-back/
WORKDIR /app/smth-back
RUN npm ci
COPY smth-back ./
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app/smth-back
ENV NODE_ENV=production

COPY --from=builder /app/smth-shared /app/smth-shared
COPY --from=builder /app/smth-back/package*.json ./
COPY --from=builder /app/smth-back/node_modules ./node_modules
COPY --from=builder /app/smth-back/dist ./dist
COPY --from=builder /app/smth-back/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm link /app/smth-shared && node dist/main"]
