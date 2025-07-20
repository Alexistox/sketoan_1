#!/bin/bash

echo "🤖 Starting Telegram Userbot..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}[ERROR]${NC} .env file not found!"
    echo "Please create .env file with required configurations:"
    echo "  - TELEGRAM_API_ID"
    echo "  - TELEGRAM_API_HASH" 
    echo "  - TELEGRAM_PHONE_NUMBER"
    echo "See USERBOT_SETUP.md for details."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[WARNING]${NC} node_modules not found. Installing dependencies..."
    npm install
fi

# Check required environment variables
source .env

if [ -z "$TELEGRAM_API_ID" ] || [ -z "$TELEGRAM_API_HASH" ] || [ -z "$TELEGRAM_PHONE_NUMBER" ]; then
    echo -e "${RED}[ERROR]${NC} Missing required environment variables!"
    echo "Please set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_PHONE_NUMBER in .env file"
    exit 1
fi

# Check if running in production mode
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${GREEN}[INFO]${NC} Starting in production mode with PM2..."
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        echo -e "${RED}[ERROR]${NC} PM2 not found. Please install PM2: npm install -g pm2"
        exit 1
    fi
    
    # Start with PM2
    pm2 start ecosystem.config.js
    pm2 save
else
    echo -e "${GREEN}[INFO]${NC} Starting in development mode..."
    node app.js
fi 