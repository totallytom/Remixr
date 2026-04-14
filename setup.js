#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

console.log('🎵 Remix Music App Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (fs.existsSync(envPath)) {
  console.log(`${colors.yellow}⚠️  .env file already exists. Skipping creation.${colors.reset}\n`);
} else {
  console.log(`${colors.blue}📝 Creating .env file...${colors.reset}`);
  
  // Read the example file
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Replace placeholder values with defaults
  envContent = envContent.replace('YOUR_SUPABASE_URL', 'https://your-project.supabase.co');
  envContent = envContent.replace('YOUR_SUPABASE_ANON_KEY', 'your-anon-key-here');
      envContent = envContent.replace('Remix Music', 'Remix Music');
  
  // Write the .env file
  fs.writeFileSync(envPath, envContent);
  console.log(`${colors.green}✅ .env file created successfully!${colors.reset}\n`);
}

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log(`${colors.yellow}⚠️  node_modules already exists. Skipping installation.${colors.reset}\n`);
} else {
  console.log(`${colors.blue}📦 Installing dependencies...${colors.reset}`);
  const { execSync } = require('child_process');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log(`${colors.green}✅ Dependencies installed successfully!${colors.reset}\n`);
  } catch (error) {
    console.log(`${colors.red}❌ Failed to install dependencies. Please run 'npm install' manually.${colors.reset}\n`);
  }
}

console.log(`${colors.green}🎉 Your Remix Music App is ready to use!${colors.reset}\n`);
console.log('Next steps:');
console.log('1. Update your .env file with your Supabase credentials');
console.log('2. Run "npm start" to start the development server');
console.log('3. Open http://localhost:3000 in your browser\n');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  try {
    console.log('This script will help you set up your environment variables for Supabase.\n');
    
    console.log('📋 Prerequisites:');
    console.log('1. Create a Supabase project at https://supabase.com');
    console.log('2. Get your project URL and anon key from Settings → API\n');
    
    const supabaseUrl = await question('Enter your Supabase project URL: ');
    const supabaseAnonKey = await question('Enter your Supabase anon key: ');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('\n❌ Error: Both URL and anon key are required.');
      process.exit(1);
    }
    
    // Create .env.local file
    const envContent = `# Supabase Configuration
REACT_APP_SUPABASE_URL=${supabaseUrl}
REACT_APP_SUPABASE_ANON_KEY=${supabaseAnonKey}

# App Configuration
REACT_APP_APP_NAME=Sypher Music
REACT_APP_APP_VERSION=1.0.0

# File Upload Configuration
REACT_APP_MAX_FILE_SIZE=10485760 # 10MB in bytes
REACT_APP_ALLOWED_AUDIO_TYPES=audio/mpeg,audio/wav,audio/ogg,audio/mp4
REACT_APP_ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp

# Feature Flags
REACT_APP_ENABLE_REAL_TIME=true
REACT_APP_ENABLE_FILE_UPLOAD=true
REACT_APP_ENABLE_COMMENTS=true
REACT_APP_ENABLE_CHAT=true
`;
    
    fs.writeFileSync('.env.local', envContent);
    
    console.log('\n✅ Environment variables configured successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Run the SQL schema in your Supabase dashboard:');
    console.log('   - Go to SQL Editor in your Supabase project');
    console.log('   - Copy and paste the contents of supabase-schema.sql');
    console.log('   - Run the script');
    console.log('\n2. Configure authentication:');
    console.log('   - Go to Authentication → Settings');
    console.log('   - Add http://localhost:3000 to redirect URLs');
    console.log('   - Enable email confirmations');
    console.log('\n3. Start the development server:');
    console.log('   npm start');
    console.log('\n🎉 Your Sypher Music App is ready to use!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setup(); 