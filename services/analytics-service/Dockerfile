# Build Stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

COPY services/analytics-service/package.json ./services/analytics-service/

RUN npm ci

COPY services/analytics-service ./services/analytics-service

RUN npm run build --workspace=@smart-campus/analytics-service

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/analytics-service/package.json ./services/analytics-service/

RUN npm ci --omit=dev --workspace=@smart-campus/analytics-service

COPY --from=build /app/services/analytics-service/dist ./services/analytics-service/dist

EXPOSE 3006
CMD ["node", "services/analytics-service/dist/index.js"]