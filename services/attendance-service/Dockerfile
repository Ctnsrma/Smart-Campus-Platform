# Build Stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

COPY services/attendance-service/package.json ./services/attendance-service/

RUN npm ci

COPY services/attendance-service ./services/attendance-service

RUN npm run build --workspace=@smart-campus/attendance-service

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/attendance-service/package.json ./services/attendance-service/

RUN npm ci --omit=dev --workspace=@smart-campus/attendance-service

COPY --from=build /app/services/attendance-service/dist ./services/attendance-service/dist

EXPOSE 3004
CMD ["node", "services/attendance-service/dist/index.js"]