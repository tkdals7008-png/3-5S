FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
COPY report-renderer/package*.json ./report-renderer/
RUN cd report-renderer && npm ci --omit=dev
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
COPY . .
ENV PORT=8080
CMD ["node", "report-renderer/server.mjs"]
