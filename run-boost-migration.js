#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Boost Tables Migration Script\n');

const sqlPath = path.join(__dirname, 'sql', 'boost-tables.sql');

if (!fs.existsSync(sqlPath)) {
  console.error('❌ boost-tables.sql file not found!');
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf8');

console.log('📋 Boost Tables SQL Migration');
console.log('==============================\n');
console.log('To set up the boost functionality, you need to run this SQL in your Supabase dashboard:\n');
console.log('1. Go to your Supabase project dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste the following SQL:');
console.log('\n' + '='.repeat(50));
console.log(sqlContent);
console.log('='.repeat(50));
console.log('\n4. Click "Run" to execute the migration');
console.log('\n✅ After running this migration, the boost functionality will work with your database!');
console.log('\n📝 Note: The app will work with mock data until you run this migration.');
console.log('   Once the tables are created, the boost features will work with real data.'); 