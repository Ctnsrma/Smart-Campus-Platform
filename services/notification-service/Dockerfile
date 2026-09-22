# Build Stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

COPY services/notification-service/package.json ./services/notification-service/

RUN npm ci

COPY services/notification-service ./services/notification-service

RUN npm run build --workspace=@smart-campus/notification-service

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/notification-service/package.json ./services/notification-service/

RUN npm ci --omit=dev --workspace=@smart-campus/notification-service

COPY --from=build /app/services/notification-service/dist ./services/notification-service/dist

EXPOSE 3005
CMD ["node", "services/notification-service/dist/index.js"]