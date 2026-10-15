FROM node:22.13.1

RUN apt update

# TODO: add packages as needed.
RUN apt install -y wget \
  vim

RUN npm install -g pm2

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev

WORKDIR /app/backend
COPY ./backend .

WORKDIR /app
COPY deployments/ecosystem.config.js .
COPY deployments/start.sh .
RUN chmod +x start.sh

EXPOSE 3004
CMD ["./start.sh"]
