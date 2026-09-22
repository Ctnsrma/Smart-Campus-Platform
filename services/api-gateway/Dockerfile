# Build Stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

COPY services/api-gateway/package.json ./services/api-gateway/

RUN npm ci

COPY services/api-gateway ./services/api-gateway

RUN npm run build --workspace=@smart-campus/api-gateway

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/api-gateway/package.json ./services/api-gateway/

RUN npm ci --omit=dev --workspace=@smart-campus/api-gateway

COPY --from=build /app/services/api-gateway/dist ./services/api-gateway/dist

EXPOSE 3000
CMD ["node", "services/api-gateway/dist/index.js"]