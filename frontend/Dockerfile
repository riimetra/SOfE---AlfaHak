FROM node:20.18.1-alpine AS build
WORKDIR /app
COPY package*.json ./
# Если lock-файл есть — строго по нему, иначе по точным версиям из package.json
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM nginx:1.27.3-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
