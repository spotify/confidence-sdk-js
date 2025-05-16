FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy application source code
COPY src/ ./src/

# Command to run the application
CMD ["node", "src/index.js"]
