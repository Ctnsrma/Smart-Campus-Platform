# Build Stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

COPY services/course-service/package.json ./services/course-service/

RUN npm ci

COPY services/course-service ./services/course-service

RUN npm run build --workspace=@smart-campus/course-service

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/course-service/package.json ./services/course-service/

RUN npm ci --omit=dev --workspace=@smart-campus/course-service

COPY --from=build /app/services/course-service/dist ./services/course-service/dist

EXPOSE 3003
CMD ["node", "services/course-service/dist/index.js"]