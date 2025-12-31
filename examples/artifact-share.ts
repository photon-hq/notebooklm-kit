import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';
    const userEmails = process.env.USER_EMAILS?.split(',') || [];
    const accessType = process.env.ACCESS_TYPE === '1' ? 1 : 2; // 1=anyone with link, 2=restricted

    console.log('=== Sharing Artifact/Notebook ===\n');
    console.log(`Notebook ID: ${notebookId}`);
    console.log(`Access Type: ${accessType === 1 ? 'Anyone with link' : 'Restricted'}\n`);

    // Share with users (if provided)
    if (userEmails.length > 0) {
      console.log('Sharing with users:');
      userEmails.forEach(email => console.log(`  - ${email}`));
      console.log();

      const result = await sdk.artifacts.share(notebookId, {
        users: userEmails.map(email => ({
          email: email.trim(),
          role: 2, // 2=Editor, 3=Viewer, 4=Remove
        })),
        notify: true, // Notify users (default: true)
        accessType: accessType,
      });

      console.log('✓ Sharing successful\n');
      console.log(`Share URL: ${result.shareUrl}`);
      console.log(`Is Shared: ${result.isShared}`);
      console.log(`Access Type: ${result.accessType === 1 ? 'Anyone with link' : 'Restricted'}`);
      if (result.users) {
        console.log(`\nShared with ${result.users.length} user(s):`);
        result.users.forEach(user => {
          const roleName = user.role === 2 ? 'Editor' : 'Viewer';
          console.log(`  - ${user.email} (${roleName})`);
        });
      }
    } else {
      // Enable link sharing only
      console.log('Enabling link sharing...\n');

      const result = await sdk.artifacts.share(notebookId, {
        accessType: accessType,
      });

      console.log('✓ Link sharing enabled\n');
      console.log(`Share URL: ${result.shareUrl}`);
      console.log(`Is Shared: ${result.isShared}`);
      console.log(`Access Type: ${result.accessType === 1 ? 'Anyone with link' : 'Restricted'}`);
    }

    console.log('\n=== User Roles ===');
    console.log('  2 = Editor (can edit notebook content)');
    console.log('  3 = Viewer (can view notebook only)');
    console.log('  4 = Remove (removes user from shared list)');

    console.log('\n=== Access Types ===');
    console.log('  1 = Anyone with link (public access)');
    console.log('  2 = Restricted (only specified users)');

    console.log('\n=== Example Usage ===');
    console.log('// Share with users (restricted access)');
    console.log('await sdk.artifacts.share(notebookId, {');
    console.log('  users: [');
    console.log('    { email: "user1@example.com", role: 2 }, // editor');
    console.log('    { email: "user2@example.com", role: 3 }, // viewer');
    console.log('  ],');
    console.log('  notify: true,');
    console.log('  accessType: 2, // restricted');
    console.log('});');
    console.log('\n// Enable link sharing (anyone with link)');
    console.log('await sdk.artifacts.share(notebookId, {');
    console.log('  accessType: 1, // anyone with link');
    console.log('});');
    console.log('\n// Remove user');
    console.log('await sdk.artifacts.share(notebookId, {');
    console.log('  users: [');
    console.log('    { email: "user@example.com", role: 4 }, // remove');
    console.log('  ],');
    console.log('  accessType: 2,');
    console.log('});');
  } catch (error) {
    handleError(error, 'Failed to share artifact');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

