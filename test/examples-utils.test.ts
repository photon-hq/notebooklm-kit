import assert from 'node:assert/strict';
import test from 'node:test';

import { chromium } from 'playwright';

import {
  cookieStringFromCookies,
  parseSavedCookieStringForAddCookies,
} from '../examples/utils.ts';

test('saved NotebookLM cookie strings normalize to Playwright addCookies-compatible cookies', async () => {
  const cookies = parseSavedCookieStringForAddCookies(
    'SID=value=with=equals; bad�=skip; keep=bad�; __Host-GAPS=host-value; ; tail=value;'
  );

  assert.deepEqual(cookies.map(cookie => cookie.name), ['SID', '__Host-GAPS', 'tail']);
  assert.equal(cookies.find(cookie => cookie.name === 'SID')?.value, 'value=with=equals');

  for (const cookie of cookies) {
    assert.ok(cookie.url || cookie.path);
    assert.ok(!(cookie.url && cookie.path));
    assert.ok(!(cookie.url && cookie.domain));
    if (cookie.domain) {
      assert.equal(cookie.domain.startsWith('.'), false);
    }
  }

  const hostCookie = cookies.find(cookie => cookie.name === '__Host-GAPS');
  assert.equal(hostCookie?.url, 'https://notebooklm.google.com/');
  assert.equal(hostCookie?.domain, undefined);
  assert.equal(hostCookie?.path, undefined);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    try {
      await context.addCookies(cookies);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test('NotebookLM cookie header export keeps one cookie per name using the most specific matching domain', () => {
  const cookieString = cookieStringFromCookies([
    { name: 'OSID', value: 'drive', domain: 'drive.google.com', path: '/' },
    { name: 'OSID', value: 'global', domain: 'google.com', path: '/' },
    { name: 'OSID', value: 'notebook', domain: 'notebooklm.google.com', path: '/' },
    { name: 'SID', value: 'jp', domain: 'google.co.jp', path: '/' },
    { name: 'SID', value: 'global', domain: '.google.com', path: '/' },
    { name: '__Host-GAPS', value: 'accounts', domain: 'accounts.google.com', path: '/' },
    { name: '__Host-GAPS', value: 'notebook', domain: 'notebooklm.google.com', path: '/' },
    { name: 'eq', value: 'a=b', domain: 'google.com', path: '/' },
  ]);

  const pairs = cookieString.split(';').map(pair => pair.trim()).filter(Boolean);
  const names = pairs.map(pair => pair.slice(0, pair.indexOf('=')));

  assert.deepEqual(names, ['OSID', 'SID', '__Host-GAPS', 'eq']);
  assert.equal(new Set(names).size, names.length);
  assert.ok(cookieString.includes('OSID=notebook'));
  assert.ok(cookieString.includes('SID=global'));
  assert.ok(cookieString.includes('__Host-GAPS=notebook'));
  assert.ok(cookieString.includes('eq=a=b'));
  assert.equal(cookieString.includes('drive'), false);
  assert.equal(cookieString.includes('accounts'), false);
  assert.equal(cookieString.includes('jp'), false);
});
