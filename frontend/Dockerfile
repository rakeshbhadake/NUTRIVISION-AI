FROM node:22-alpine AS development
WORKDIR /web
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
FROM development AS build
RUN npm run build
