FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Build TypeScript
COPY tsconfig.json .
COPY src ./src
RUN npm run build

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
