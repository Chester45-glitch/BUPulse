# Use Node.js 20 as the base image
FROM node:20

# Install Chromium and the system libraries Puppeteer needs to run on Linux
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of your backend code
COPY . .

# Environment variables so Puppeteer knows where Chromium is hiding
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Standard Render port
EXPOSE 10000

CMD ["node", "server.js"]