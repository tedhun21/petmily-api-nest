# 개발 환경을 위한 빌드 단계
FROM node:lts-alpine AS development

WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --silent
COPY . .
EXPOSE 8080

CMD ["npm", "run", "start"]

# 프로덕션 환경을 위한 빌드 단계
FROM node:lts-alpine AS production

WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --production --silent
COPY . .
RUN npm run build

EXPOSE 8080

CMD ["node", "dist/main"]
