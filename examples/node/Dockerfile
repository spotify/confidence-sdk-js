FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy application source code
COPY src/ ./src/

EXPOSE 3000
EXPOSE 9229

# Command to run the application
CMD ["node", "--inspect=0.0.0.0:9229", "src/index.js"]
