import { createSDK, handleError } from './utils.js';

const NOTEBOOK_ID = process.env.NOTEBOOK_ID;

async function main() {
  if (!NOTEBOOK_ID) {
    console.error('NOTEBOOK_ID environment variable is required');
    process.exit(1);
  }

  const sdk = createSDK();

  try {
    // Update title only
    const updated1 = await sdk.notebooks.update(NOTEBOOK_ID, {
      title: 'Updated Title',
    });
    console.log(`Updated: ${updated1.title}\n`);

    // Update emoji only
    const updated2 = await sdk.notebooks.update(NOTEBOOK_ID, {
      emoji: '🔥',
    });
    console.log(`Emoji updated: ${updated2.emoji}\n`);

    // Update both title and emoji
    const updated3 = await sdk.notebooks.update(NOTEBOOK_ID, {
      title: 'New Title',
      emoji: '⭐',
    });
    console.log(`Updated: ${updated3.emoji} ${updated3.title}\n`);

    // Update description only
    const updated4 = await sdk.notebooks.update(NOTEBOOK_ID, {
      description: 'Updated description',
    });
    console.log(`Description updated\n`);

    // Update all fields
    const updated5 = await sdk.notebooks.update(NOTEBOOK_ID, {
      title: 'Final Title',
      description: 'Final description',
      emoji: '🎯',
    });
    console.log(`Updated: ${updated5.emoji} ${updated5.title}`);
    console.log(`Sources: ${updated5.sourceCount || 0}`);
    console.log(`Last accessed: ${updated5.lastAccessed || 'Never'}`);
  } catch (error) {
    handleError(error, 'Failed to update notebook');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

