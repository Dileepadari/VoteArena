
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

console.log(`${colors.blue}🚀 Starting deployment process...${colors.reset}`);

// Check if the dist directory exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  console.log(`${colors.yellow}📦 Building the application...${colors.reset}`);
  
  try {
    // Install dependencies if node_modules doesn't exist
    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
      console.log(`${colors.yellow}📚 Installing dependencies...${colors.reset}`);
      execSync('npm install', { stdio: 'inherit' });
    }
    
    // Install express and compression if not in dependencies
    try {
      require.resolve('express');
      require.resolve('compression');
    } catch (e) {
      console.log(`${colors.yellow}📚 Installing server dependencies...${colors.reset}`);
      execSync('npm install express compression', { stdio: 'inherit' });
    }
    
    // Build the app
    execSync('npm run build', { stdio: 'inherit' });
    console.log(`${colors.green}✅ Build completed successfully${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}❌ Build failed:${colors.reset}`, error);
    process.exit(1);
  }
} else {
  console.log(`${colors.green}✅ Build already exists${colors.reset}`);
}

// Start the server
console.log(`${colors.blue}🌐 Starting server...${colors.reset}`);
try {
  execSync('node server.js', { stdio: 'inherit' });
} catch (error) {
  console.error(`${colors.red}❌ Server start failed:${colors.reset}`, error);
  process.exit(1);
}
