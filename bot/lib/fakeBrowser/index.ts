import { log } from '@lib/log';
import { instance as processManager } from '@lib/processManager';
import puppeteer, { type Browser, type Page, ProtocolError, type PuppeteerLaunchOptions } from 'puppeteer';

let browser: Browser | null = null;

const getLaunchOptions = async (): Promise<PuppeteerLaunchOptions> => {
  try {
    const options: PuppeteerLaunchOptions = await Bun.file(Bun.fileURLToPath(import.meta.resolve('./launchOptions.json'))).json();
    return options;
  }
  catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ERR_MODULE_NOT_FOUND') {
      log(`fakeBrowser#${getLaunchOptions.name}:`, 'launchOptions.json not found');
      return { headless: true };
    }
    throw e;
  }
};

const initialize = async (): Promise<Browser> => {
  const launchOptions = await getLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);
  log('fakeBrowser:', 'new browser instance initialized');

  processManager.add(browser.process());

  return browser;
};

export const getBrowser = async (): Promise<Browser> => browser ??= await initialize();

export const closePage = async (label: string, page: Page): Promise<boolean> => {
  try {
    await page.close();
    return true;
  }
  catch (e) {
    if (e instanceof ProtocolError || (e instanceof Error && e.message.startsWith('Protocol error:'))) {
      log(`fakeBrowser#${closePage.name}[${label}]:`, 'failed to close page', e.stack ?? `${e.name}: ${e.message}`);
      return false;
    }
    throw e;
  }
};

export const closeBrowserIfNoPages = async (label: string): Promise<void> => {
  if (browser == null) return;

  const pages = await browser.pages();
  log(`fakeBrowser[${label}]:`, `${pages.length} pages`);

  if (pages.length === 1) {
    await browser.close();
    browser = null;

    log(`fakeBrowser[${label}]:`, 'browser closed');
  }
};
