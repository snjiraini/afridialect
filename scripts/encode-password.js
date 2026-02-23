#!/usr/bin/env node

/**
 * URL Encoder for Database Password
 * Helps encode special characters in passwords for DATABASE_URL
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         DATABASE PASSWORD URL ENCODER                         ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('This tool will help you URL-encode your database password.');
console.log('Special characters in passwords need to be encoded for DATABASE_URL.\n');

// Hide password input
function hideInput() {
  const stdin = process.stdin;
  if (stdin.setRawMode) {
    stdin.setRawMode(true);
  }
}

function showInput() {
  const stdin = process.stdin;
  if (stdin.setRawMode) {
    stdin.setRawMode(false);
  }
}

function readPassword(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    hideInput();
    
    let password = '';
    
    process.stdin.on('data', function(char) {
      char = char.toString();
      
      switch(char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.pause();
          process.stdout.write('\n');
          showInput();
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          showInput();
          process.exit();
          break;
        case '\u007f': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function main() {
  try {
    const password = await readPassword('Enter your database password (hidden): ');
    
    if (!password) {
      console.log('\n❌ No password entered');
      process.exit(1);
    }
    
    // URL encode the password
    const encoded = encodeURIComponent(password);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Password encoded successfully!\n');
    console.log('Original length:', password.length, 'characters');
    console.log('Encoded length:', encoded.length, 'characters\n');
    console.log('📋 Your URL-encoded password:\n');
    console.log('   ', encoded);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Update your .env.local:\n');
    console.log('Replace this line:');
    console.log('  DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres\n');
    console.log('With (use your actual project ID):');
    console.log(`  DATABASE_URL=postgresql://postgres.phjgebfpybxcbfkxnckb:${encoded}@aws-0-us-west-1.pooler.supabase.com:6543/postgres\n`);
    console.log('Or get the full connection string from Supabase Dashboard:\n');
    console.log('  Settings → Database → Connection string (URI)\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
