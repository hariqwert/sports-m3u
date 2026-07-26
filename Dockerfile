# Use official lightweight Node.js image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies if any
RUN npm install --production

# Copy application source
COPY . .

# Environment variable for port
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start dynamic 45-minute auto-refreshing M3U server
CMD ["npm", "start"]
