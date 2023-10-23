import puppeteer, { Browser, Page, ProtocolError } from 'puppeteer';
import { log } from '../log.js';
import { instance as processManager } from '../processManager.js';

/** @type {Browser | null} */
let browser = null;

/**
 * @returns {Promise<import('puppeteer').PuppeteerLaunchOptions>}
 */
const getLaunchOptions = async () => {
  try {
    const { default: options } = /** @type {{ default: import('puppeteer').PuppeteerLaunchOptions }} */ (await import(
      // @ts-ignore
      './launchOptions.json',
      { assert: { type: 'json' } },
    ));
    return options;
  }
  catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ERR_MODULE_NOT_FOUND') {
      log(`fakeBrowser#${getLaunchOptions.name}:`, 'launchOptions.json not found');
      return { headless: 'new' };
    }
    throw e;
  }
};

/**
 * @returns {Promise<Browser>}
 */
const initialize = async () => {
  const launchOptions = await getLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);

  processManager.add(browser.process());

  return browser;
};

/** @returns {Promise<Browser>} */
export const getBrowser = async () => browser ??= await initialize();

/**
 * @param {Page} page
 * @returns {Promise<boolean>} success to close page
 */
export const closePage = async page => {
  try {
    await page.close();
    return true;
  }
  catch (e) {
    if (e instanceof ProtocolError || (e instanceof Error && e.message.startsWith('Protocol error:'))) {
      log(`fakeBrowser#${closePage.name}:`, 'failed to close page', e.stack ?? `${e.name}: ${e.message}`);
      return false;
    }
    throw e;
  }
};

export const closeBrowserIfNoPages = async () => {
  if (browser == null) return;

  const pages = await browser.pages();
  if (pages.length === 1) {
    await browser.close();
    browser = null;
  }
};
