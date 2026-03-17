FROM node:20-slim
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --production
ARG CACHE_BUST=1
COPY server.js database.js ./
COPY public/ ./public/
RUN mkdir -p /app/data /app/uploads
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "require('http').get('http://localhost:3000/api/auth/check',r=>{process.exit(r.statusCode<500?0:1)}).on('error',()=>process.exit(1))"
CMD ["node","server.js"]
