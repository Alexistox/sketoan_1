#!/bin/bash

echo "🚀 Starting deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project directory?"
    exit 1
fi

# Pull latest changes
print_status "Pulling latest changes from Git..."
git pull origin main
if [ $? -ne 0 ]; then
    print_error "Failed to pull from Git"
    exit 1
fi

# Install/update dependencies
print_status "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

# Check if PM2 is running
print_status "Checking PM2 status..."
if pm2 list | grep -q "userbot"; then
    print_status "Restarting userbot with PM2..."
    pm2 restart userbot
else
    print_warning "Userbot not found in PM2, starting new instance..."
    pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

print_status "Deployment completed successfully! ✅"
print_status "View logs with: pm2 logs userbot"
print_status "Check status with: pm2 status" 