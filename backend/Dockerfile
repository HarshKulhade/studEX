FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --only=production

# Bundle app source
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Start the server
CMD [ "npm", "start" ]
