# ─────────────────────────────────────────────────────────────────
# BUPulse Backend — Dockerfile for Render (Puppeteer + Chrome)
# ─────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

# ── Install Chrome + all Puppeteer system dependencies ───────────
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg \
    ca-certificates \
    xvfb \
    # Chrome deps
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    fonts-liberation \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# ── Install Google Chrome Stable ─────────────────────────────────
RUN wget -q -O /tmp/google-chrome.deb \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y /tmp/google-chrome.deb \
    && rm /tmp/google-chrome.deb \
    && rm -rf /var/lib/apt/lists/*

# ── App setup ────────────────────────────────────────────────────
WORKDIR /app

# Tell Puppeteer to use the system Chrome we just installed
# and skip downloading its own bundled Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV BULMS_HEADLESS=true
ENV NODE_ENV=production

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# ── Start ────────────────────────────────────────────────────────
# xvfb-run gives Puppeteer a virtual display (needed even in
# headless mode for some Chrome flags on certain distros)
CMD ["sh", "-c", "xvfb-run -a --server-args='-screen 0 1280x800x24' node server.js"]
