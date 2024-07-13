# Use the official Node.js 20 slim image as base
FROM node:20
# Definir las variables de entorno
ARG TOKEN=""
ARG OPENAI_SERVER=""
ARG MODEL=""
ARG PIPER_API_URL=""
ARG PIPER_MODEL=""

WORKDIR /home/app
RUN apt update && apt install -y chromium
RUN mkdir chats; mkdir temp

COPY package*.json ./
RUN npm install

COPY . .

RUN if [ -n "$TOKEN" ]; then echo "TOKEN=$TOKEN" >> .env; fi && \
    if [ -n "$OPENAI_SERVER" ]; then echo "OPENAI_SERVER=$OPENAI_SERVER" >> .env; fi && \
    if [ -n "$MODEL" ]; then echo "MODEL=$MODEL" >> .env; fi && \
    if [ -n "$PIPER_API_URL" ]; then echo "PIPER_API_URL=$PIPER_API_URL" >> .env; fi && \
    if [ -n "$PIPER_MODEL" ]; then echo "PIPER_MODEL=$PIPER_MODEL" >> .env; fi

CMD ["node", "app-without-tts.js"]
