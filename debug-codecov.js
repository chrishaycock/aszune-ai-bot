// Simple script to help debug codecov issues
const fs = require('fs');
const path = require('path');

console.log('===== Repository Debug Info =====');
console.log('Current directory:', process.cwd());

// Try to read package.json
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  console.log('\nPackage.json repository field:', packageJson.repository || 'Not set');
  console.log('Package.json name:', packageJson.name);
} catch (e) {
  console.error('Error reading package.json:', e.message);
}

// Output git info
console.log('\n===== Git Config Info =====');
console.log('Environment variables:');
Object.keys(process.env)
  .filter(key => key.includes('GIT') || key.includes('GITHUB') || key.includes('CODECOV') || key.includes('REPO'))
  .forEach(key => {
    console.log(`${key}=${process.env[key]}`);
  });

console.log('\nWriting debug info to debug-output.json');
fs.writeFileSync(
  path.join(process.cwd(), 'debug-output.json'), 
  JSON.stringify({ env: process.env }, null, 2)
);
