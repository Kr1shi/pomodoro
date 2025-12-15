FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm config set fetch-timeout 60000 && \
    npm config set registry https://registry.npmjs.org/ && \
    npm install --omit=dev

# Copy application files
COPY server.js ./
COPY public/ ./public/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 7272

CMD ["node", "server.js"]
