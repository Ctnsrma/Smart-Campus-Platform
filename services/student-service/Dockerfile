# Build Stage
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./

COPY services/student-service/package.json ./services/student-service/

RUN npm ci

COPY services/student-service ./services/student-service

RUN npm run build --workspace=@smart-campus/student-service

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/student-service/package.json ./services/student-service/

RUN npm ci --omit=dev --workspace=@smart-campus/student-service

COPY --from=build /app/services/student-service/dist ./services/student-service/dist

EXPOSE 3002
CMD ["node", "services/student-service/dist/index.js"]