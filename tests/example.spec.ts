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
    if (req.url === '/downloadWithDelay') {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
      res.write('a'.repeat(4096));
      res.uncork();
      // Uncomment the following line to make the test pass.
      // res.end();
      return;
    }
    if (req.url === '/index.html') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<a href="/downloadWithDelay">download</a>');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('hello world\n');
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
    // Click the link to start download.
    await page.click('a');
    await context.close();
  }
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    let error = null;
    await page.goto(serverPrefix + '/index.html').catch(e => error = e);
    expect(error).not.toBe(null);
    await context.close();
  }
});
