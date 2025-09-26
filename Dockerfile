FROM node:18-alpine

WORKDIR /app

# Copy package.json first
COPY package.json ./

# Remove package-lock.json if it exists and install dependencies
RUN rm -f package-lock.json && \
    npm install --production=false && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
