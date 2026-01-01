import { createSDK, handleError } from './utils.js';
import * as readline from 'readline';

interface UserShare {
  email: string;
  role: 2 | 3 | 4; // 2=editor, 3=viewer, 4=commenter
}

/**
 * Prompt user for input
 */
function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for notebook ID
 */
async function promptNotebookId(rl: readline.Interface): Promise<string> {
  const envNotebookId = process.env.NOTEBOOK_ID;
  if (envNotebookId) {
    const useEnv = await question(rl, `Notebook ID from env: ${envNotebookId}\nUse this? (Y/n): `);
    if (!useEnv || useEnv.toLowerCase() === 'y' || useEnv.toLowerCase() === 'yes') {
      return envNotebookId;
    }
  }
  
  const notebookId = await question(rl, 'Enter Notebook ID: ');
  if (!notebookId) {
    throw new Error('Notebook ID is required');
  }
  return notebookId;
}

/**
 * Prompt for sharing type
 */
async function promptSharingType(rl: readline.Interface): Promise<'users' | 'link'> {
  console.log('\nSharing options:');
  console.log('  1. Share with specific users (restricted access)');
  console.log('  2. Enable link sharing (anyone with link)');
  
  const choice = await question(rl, '\nChoose option (1 or 2): ');
  
  if (choice === '1') {
    return 'users';
  } else if (choice === '2') {
    return 'link';
  } else {
    console.log('Invalid choice. Defaulting to link sharing.');
    return 'link';
  }
}

/**
 * Prompt for user emails and roles
 */
async function promptUsers(rl: readline.Interface): Promise<UserShare[]> {
  const users: UserShare[] = [];
  
  console.log('\nEnter user emails and permissions:');
  console.log('  - Enter emails separated by commas, or one per line');
  console.log('  - Format: email:role (e.g., user@example.com:editor)');
  console.log('  - Roles: editor (2), viewer (3), or commenter (4)');
  console.log('  - Press Enter on empty line to finish\n');
  
  while (true) {
    const input = await question(rl, 'Enter email:role (or press Enter to finish): ');
    
    if (!input) {
      break;
    }
    
    // Handle comma-separated emails
    const entries = input.split(',').map(e => e.trim());
    
    for (const entry of entries) {
      if (!entry) continue;
      
      // Check if role is specified (email:role format)
      const parts = entry.split(':').map(p => p.trim());
      const email = parts[0];
      
      if (!email || !email.includes('@')) {
        console.log(`  ⚠️  Invalid email format: ${entry}`);
        continue;
      }
      
      // Parse role
      let role: 2 | 3 | 4 = 3; // Default to viewer
      if (parts.length > 1) {
        const roleStr = parts[1].toLowerCase();
        if (roleStr === 'editor' || roleStr === '2') {
          role = 2;
        } else if (roleStr === 'viewer' || roleStr === '3') {
          role = 3;
        } else if (roleStr === 'commenter' || roleStr === '4') {
          role = 4;
        } else {
          console.log(`  ⚠️  Invalid role "${parts[1]}", defaulting to viewer`);
        }
      }
      
      users.push({ email, role });
      console.log(`  ✓ Added: ${email} (${role === 2 ? 'Editor' : 'Viewer'})`);
    }
  }
  
  return users;
}

/**
 * Prompt for notification preference
 */
async function promptNotify(rl: readline.Interface): Promise<boolean> {
  const notify = await question(rl, '\nNotify users via email? (Y/n): ');
  return !notify || notify.toLowerCase() === 'y' || notify.toLowerCase() === 'yes';
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let sdk: Awaited<ReturnType<typeof createSDK>> | null = null;

  try {
    console.log('=== Notebook Sharing ===\n');
    
    // Get notebook ID
    const notebookId = await promptNotebookId(rl);
    
    // Get sharing type
    const sharingType = await promptSharingType(rl);
    
    sdk = await createSDK();
    await sdk.connect();
    
    if (sharingType === 'users') {
      // Share with specific users
      const users = await promptUsers(rl);
      
      if (users.length === 0) {
        console.log('\n⚠️  No users provided. Exiting.');
        rl.close();
        if (sdk) sdk.dispose();
        process.exit(0);
      }
      
      const notify = await promptNotify(rl);
      
      console.log('\n📤 Sharing notebook...\n');
      
      const result = await sdk.notebooks.share(notebookId, {
        users: users.map(u => ({ email: u.email, role: u.role })),
        notify,
        accessType: 2, // Restricted access
      });

      console.log('\n✅ Sharing successful!\n');
      console.log(`Share URL: ${result.shareUrl}`);
      console.log(`Access Type: Restricted`);
      console.log(`Users:`);
      result.users?.forEach(user => {
        const roleMap: Record<number, string> = { 2: 'Editor', 3: 'Viewer', 4: 'Commenter' };
        const roleName = roleMap[user.role as 2 | 3 | 4] || 'Unknown';
        console.log(`  - ${user.email} (${roleName})`);
      });
    } else {
      // Enable link sharing
      console.log('\n📤 Enabling link sharing...\n');
      
      const result = await sdk.notebooks.share(notebookId, {
        accessType: 1, // Anyone with link
      });

      console.log('\n✅ Link sharing enabled!\n');
      console.log(`Share URL: ${result.shareUrl}`);
      console.log(`Access Type: Anyone with link`);
      console.log(`Is Shared: ${result.isShared}`);
    }
  } catch (error) {
    console.error('\n❌ Error sharing notebook\n');
    
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('internal error')) {
        console.error('The NotebookLM API returned an internal error.');
        console.error('This might be a temporary server issue. Please try:');
        console.error('  1. Wait a few minutes and try again');
        console.error('  2. Check if the notebook exists and you have permission to share it');
        console.error('  3. Try sharing from the NotebookLM web interface');
      } else if (errorMessage.includes('service unavailable')) {
        console.error('The NotebookLM service is currently unavailable.');
        console.error('This might be a temporary outage. Please try:');
        console.error('  1. Wait a few minutes and try again');
        console.error('  2. Check https://notebooklm.google.com to see if the service is up');
      } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        console.error('Authentication failed. Please check your credentials.');
        console.error('Try running with FORCE_REAUTH=true to refresh your authentication.');
      } else if (errorMessage.includes('400') || errorMessage.includes('bad request')) {
        console.error('Invalid request. This might be due to:');
        console.error('  - Invalid notebook ID');
        console.error('  - Invalid email addresses');
        console.error('  - Invalid role permissions');
      } else {
        console.error(`Error: ${error.message}`);
      }
      
      console.error('\nFull error details:');
      console.error(error.stack || error.message);
    } else {
      console.error('Unknown error:', error);
    }
    
    process.exit(1);
  } finally {
    rl.close();
    if (sdk) {
      sdk.dispose();
    }
    process.exit(0);
  }
}

main().catch(console.error);

