import { exportCookiesToOpenClawSecrets, handleError } from './utils.js';

async function main() {
  try {
    const result = await exportCookiesToOpenClawSecrets();
    console.log(`\nSaved cookies to ${result.filePath}`);
    console.log(`Cookie length: ${result.cookiesLength}`);
    console.log(`Login resolution: ${result.loginResolution}`);
  } catch (error) {
    handleError(error, 'Failed to export NotebookLM cookies');
  }
}

main().catch(console.error);
