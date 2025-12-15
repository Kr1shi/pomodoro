FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application files
COPY server.js ./
COPY public/ ./public/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["node", "server.js"]
