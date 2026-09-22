# Build Stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

COPY services/auth-service/package.json ./services/auth-service/

RUN npm ci

COPY services/auth-service ./services/auth-service

RUN npm run build --workspace=@smart-campus/auth-service

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/auth-service/package.json ./services/auth-service/

RUN npm ci --omit=dev --workspace=@smart-campus/auth-service

COPY --from=build /app/services/auth-service/dist ./services/auth-service/dist

EXPOSE 3001
CMD ["node", "services/auth-service/dist/index.js"]