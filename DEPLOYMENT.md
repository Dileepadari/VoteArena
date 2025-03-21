
# Deployment Guide

This application is optimized for 200+ concurrent users with client-side storage and performance enhancements.

## Quick Deployment

### Option 1: Using the deployment script

Run one of the following commands:

```bash
# On Windows
node deploy.js

# On macOS/Linux
./deploy.sh
```

This will:
1. Install dependencies (if needed)
2. Build the application
3. Start the server on port 3000

### Option 2: Manual deployment

```bash
# Install dependencies
npm install

# Install server dependencies
npm install express compression

# Build the application
npm run build

# Start the server
node server.js
```

## Performance Optimizations

This deployment includes:

- Compressed responses with gzip/deflate
- Static asset caching
- Security headers
- Client-side storage optimizations
- Vote batching and throttling
- Memory caching for frequently accessed data

## Accessing the Application

Once deployed, the application will be available at:
- http://localhost:3000

## Scaling Further

For even larger deployments (1000+ users), consider:
- Using a dedicated database instead of localStorage
- Implementing a load balancer
- Deploying to a cloud platform with auto-scaling
