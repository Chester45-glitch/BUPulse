# ─────────────────────────────────────────────────────────────────
# BUPulse Backend — Dockerfile for Render
# Fixed: let Puppeteer download its own Chrome (no manual wget)
# ─────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

# ── Install ONLY the system libraries Chrome needs to run ─────────
# We do NOT download Chrome here — Puppeteer's npm install does it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    xvfb \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# ── App setup ────────────────────────────────────────────────────
WORKDIR /app

# Allow Puppeteer to download its own bundled Chrome during npm install.
# Do NOT set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD or PUPPETEER_EXECUTABLE_PATH —
# Puppeteer will find its own Chrome automatically.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV NODE_ENV=production
ENV BULMS_HEADLESS=true

# Copy package files first (layer caching — Chrome only re-downloads
# when package.json changes)
COPY package*.json ./

# npm ci triggers Puppeteer's postinstall which downloads Chrome (~170 MB)
RUN npm ci --omit=dev

# Copy the rest of the source
COPY . .

# ── Start with a virtual display (xvfb) ─────────────────────────
CMD ["sh", "-c", "xvfb-run -a --server-args='-screen 0 1280x800x24' node server.js"]
