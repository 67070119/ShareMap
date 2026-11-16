FROM node:24-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN npm run prisma:generate

COPY src ./src
# Only the operator-triggered first-Admin CLI belongs in production.
# Do not ship DB-mutating E2E fixtures or isolated QA scripts.
COPY scripts/bootstrap-admin.mjs ./scripts/bootstrap-admin.mjs
ENV NODE_ENV=production

EXPOSE 4000
CMD ["npm", "run", "start"]
