import { createSDK, handleError } from './utils.js';

async function main() {
  const sdk = createSDK();

  try {
    await sdk.connect(); // Initialize SDK with authentication

    const notebookId = process.env.NOTEBOOK_ID || 'your-notebook-id';

    console.log('=== Adding Text Source ===\n');

    // Add text source
    const sourceId = await sdk.sources.add.text(notebookId, {
      title: 'Research Notes',
      content: `
# Research Notes

## Key Findings

1. Machine learning models require large datasets
2. Transfer learning can reduce training time
3. Fine-tuning improves model performance

## References

- Paper 1: "Deep Learning Fundamentals"
- Paper 2: "Transfer Learning Techniques"
      `.trim(),
    });
    console.log(`Added text source`);
    console.log(`Source ID: ${sourceId}\n`);

    // Check processing status
    const status = await sdk.sources.status(notebookId);
    console.log(`Processing status: ${status.allReady ? 'All ready' : `${status.processing.length} still processing`}`);
  } catch (error) {
    handleError(error, 'Failed to add text source');
  }

  sdk.dispose();
  process.exit(0);
}

main().catch(console.error);

