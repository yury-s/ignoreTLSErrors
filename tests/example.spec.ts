import { test, expect } from '@playwright/test';

import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'

const port = 3000;
const serverPrefix = `https://localhost:${port}`;

let server: https.Server;

test.beforeAll(async () => {
  server = https.createServer({
    key: await fs.promises.readFile(path.join(__dirname, 'key.pem')),
    cert: await fs.promises.readFile(path.join(__dirname, 'cert.pem')),
    passphrase: 'aaaa',

  }, (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('Hello');
  });
  await new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server running at ${serverPrefix}/`, server.address());
      resolve({});
    });
  });
});

test('ignoreTLSErrors should be isolated between contexts', async ({ browser }) => {
  {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(serverPrefix + '/index.html');
    await expect(page.getByText('Hello')).toBeVisible();
    await page.close();
    // Closing the context will remove WebsiteDataStore and stop the network process
    // which will make the test pass.
    // await context.close();
  }
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    let error = null;
    await page.goto(serverPrefix + '/index.html').catch(e => error = e);
    expect(error, 'A TLS error expected, but the request succeeded.').not.toBe(null);
    await context.close();
  }
});
