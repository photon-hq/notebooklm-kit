/**
 * NotebookLM Credentials Extractor
 * 
 * Simple script to extract credentials from browser for .env file
 * 
 * Usage:
 * 1. Open https://notebooklm.google.com in your browser (make sure you're logged in)
 * 2. Open Developer Tools (F12 or Cmd+Option+I)
 * 3. Go to Console tab
 * 4. Paste and run this script
 * 5. Follow instructions to add HttpOnly cookies if needed
 * 6. Copy the output to your .env file
 */

(function() {
  console.log("=".repeat(60));
  console.log("📋 NotebookLM Credentials Extractor");
  console.log("=".repeat(60) + "\n");

  // Get auth token from WIZ_global_data
  function tryGetToken() {
    try {
      if (window.WIZ_global_data && window.WIZ_global_data.SNlM0e) {
        return window.WIZ_global_data.SNlM0e;
      }
    } catch (e) {}
    return null;
  }
  
  let authToken = tryGetToken();
  if (!authToken) {
    setTimeout(() => {
      authToken = tryGetToken();
    }, 1000);
  }

  // Get visible cookies
  let visibleCookies = document.cookie;
  const cookieMap = {};
  visibleCookies.split(';').forEach(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name) {
      cookieMap[name] = valueParts.join('=');
    }
  });

  // Check for required cookies
  const requiredCookies = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID'];
  const missingCookies = requiredCookies.filter(name => !cookieMap[name]);

  // Output function
  function outputCredentials(customCookies = null) {
    let finalCookies = customCookies || visibleCookies;
    let finalCookieMap = { ...cookieMap };
    
    // If custom cookies provided, merge them
    if (customCookies) {
      customCookies.split(';').forEach(cookie => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length > 0) {
          finalCookieMap[name] = valueParts.join('=');
        }
      });
      finalCookies = Object.entries(finalCookieMap)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }

    // Update token if found
    if (!authToken) {
      authToken = tryGetToken();
    }

    console.log("\n" + "=".repeat(60));
    console.log("📋 Copy to .env file:\n");
    
    const output = [
      `NOTEBOOKLM_AUTH_TOKEN=${authToken || "<NOT_FOUND>"}`,
      `NOTEBOOKLM_COOKIES="${finalCookies.replace(/"/g, '\\"')}"`
    ].join("\n");

    console.log(output);
    console.log("\n" + "=".repeat(60));

    // Check final status
    const finalMissing = requiredCookies.filter(name => !finalCookieMap[name]);
    if (finalMissing.length > 0) {
      console.log(`\n⚠️  Missing cookies: ${finalMissing.join(", ")}`);
      console.log("\n📋 To add HttpOnly cookies:");
      console.log("   1. DevTools > Application > Cookies > https://notebooklm.google.com");
      console.log("   2. Copy each cookie: Name=Value");
      console.log("   3. Run: addCookies('SID=value; HSID=value; SSID=value; APISID=value; SAPISID=value')");
    }

    // Try to copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(output).then(() => {
        console.log("\n✅ Copied to clipboard!");
      }).catch(() => {
        console.log("\n💡 Select and copy manually");
      });
    } else {
      console.log("\n💡 Select and copy manually");
    }

    return output;
  }

  // Helper to add HttpOnly cookies manually
  window.addCookies = function(cookieString) {
    console.log("\n✅ Adding cookies...\n");
    return outputCredentials(cookieString);
  };

  // Expose main function
  window.getCredentials = outputCredentials;

  // Show initial status
  if (missingCookies.length > 0) {
    console.log(`⚠️  Missing HttpOnly cookies: ${missingCookies.join(", ")}\n`);
    console.log("📋 To get HttpOnly cookies:");
    console.log("   1. DevTools > Application > Cookies > https://notebooklm.google.com");
    console.log("   2. Find: SID, HSID, SSID, APISID, SAPISID");
    console.log("   3. Copy as: Name=Value (e.g., 'SID=value; HSID=value')");
    console.log("   4. Run: addCookies('SID=value; HSID=value; SSID=value; APISID=value; SAPISID=value')\n");
  }

  // Auto-output after 2 seconds
  setTimeout(() => {
    console.log("\n⏱️  Generating credentials...\n");
    outputCredentials();
  }, 2000);

  console.log("\n💡 Commands:");
  console.log("   - getCredentials() - Output credentials");
  console.log("   - addCookies('SID=value; HSID=value; ...') - Add HttpOnly cookies\n");

})();

