## --- Builder Stage ---
FROM node:lts-alpine AS builder

RUN apk add --no-cache git python3 build-base

WORKDIR /opt/app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


## --- Final Runtime Stage ---
FROM node:lts-alpine

RUN apk add --no-cache git python3

WORKDIR /opt/app

COPY --from=builder /opt/app/node_modules ./node_modules
COPY --from=builder /opt/app/dist ./dist
COPY package.json .

EXPOSE 3003 3004

CMD ["node", "dist/index.js"]
