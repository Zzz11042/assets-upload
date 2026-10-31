import { chromium } from 'playwright-core';
import fs from 'node:fs';
const ctx = await chromium.connectOverCDP('http://127.0.0.1:9222').catch(() => null);
console.log('cdp not available, falling back');
