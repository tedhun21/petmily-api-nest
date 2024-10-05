# multi-stage (@nest/cli가 dev 종속성으로 빠져있다. 그래서 npm run build를 해야한다. 이렇게 되면 이미지의 크기가 늘어난다. 해결책은 multi-stage)
# 빌드 부분에서 종속성 다 설치하고 필요한 파일만 뽑아서 갈아 엎고 다시 실행


###################
# BUILD FOR LOCAL DEVELOPMENT
###################

# 베이스 이미지 설정 (Alpine Linux 기반 Node.js LTS 이미지)
FROM node:lts-alpine AS development

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# package.json 및 잠금 파일 복사
COPY ["package.json", "package-lock.json*", "./"]

# 모든 종속성 설치 (devDependencies 포함)
RUN npm install --silent

# 소스 파일 복사
COPY . .

# 애플리케이션 빌드
RUN npm run build


###################
# PRODUCTION
###################

# 최종 생산 이미지를 위한 새로운 단계
FROM node:lts-alpine AS production

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# package.json 및 잠금 파일 복사 (production 환경을 위해)
COPY ["package.json", "package-lock.json*", "./"]

# 개발 단계에서 빌드한 node_modules와 dist 폴더 복사
COPY --from=development /usr/src/app/node_modules ./node_modules
COPY --from=development /usr/src/app/dist ./dist

# 환경 변수 설정 (이건 무조건 npm install --production 실행)
ENV NODE_ENV=production

# 포트 노출
EXPOSE 8080

# 소유자 권한 설정
RUN chown -R node /usr/src/app

# 사용자 변경
USER node

# 애플리케이션 실행
CMD ["node", "dist/main"]