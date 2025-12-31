import { createSDK, handleError } from './utils.js';

const NOTEBOOK_ID = process.env.NOTEBOOK_ID;
const USER_EMAILS = process.env.USER_EMAILS?.split(',').map(e => e.trim());

async function main() {
  if (!NOTEBOOK_ID) {
    console.error('NOTEBOOK_ID environment variable is required');
    process.exit(1);
  }

  const sdk = await createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication
    if (USER_EMAILS && USER_EMAILS.length > 0) {
      // Share with specific users
      const result = await sdk.notebooks.share(NOTEBOOK_ID, {
        users: USER_EMAILS.map(email => ({
          email,
          role: 3, // 2=editor, 3=viewer
        })),
        notify: true,
        accessType: 2, // 2=restricted, 1=anyone with link
      });

      console.log(`Share URL: ${result.shareUrl}`);
      console.log(`Success: ${result.success}`);
      console.log(`Access Type: ${result.accessType === 1 ? 'Anyone with link' : 'Restricted'}`);
      console.log(`Users:`);
      result.users?.forEach(user => {
        console.log(`  - ${user.email} (${user.role === 2 ? 'Editor' : 'Viewer'})`);
      });
    } else {
      // Enable link sharing (anyone with link)
      const result = await sdk.notebooks.share(NOTEBOOK_ID, {
        accessType: 1, // 1=anyone with link, 2=restricted
      });

      console.log(`Share URL: ${result.shareUrl}`);
      console.log(`Success: ${result.success}`);
      console.log(`Access Type: ${result.accessType === 1 ? 'Anyone with link' : 'Restricted'}`);
      console.log(`Is Shared: ${result.isShared}`);
    }
  } catch (error) {
    handleError(error, 'Failed to share notebook');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

