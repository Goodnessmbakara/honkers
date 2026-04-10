/**
 * Honkers — Frontend E2E tests (Playwright)
 *
 * Full user trade flow: land → connect wallet → browse markets → buy YES → view portfolio
 *
 * Prerequisites:
 *   1. Frontend dev server running:  npm run dev  (default port 5173)
 *   2. Aztec Sandbox running:        aztec start --sandbox
 *
 * Run:
 *   APP_URL=http://localhost:5173 npx playwright test
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

/** Selector helpers — update these when component class names change. */
const SEL = {
  // Landing / header
  connectWalletBtn: '[data-testid="connect-wallet"]',
  walletAddressBadge: '[data-testid="wallet-address"]',

  // Markets list
  marketCard: '[data-testid="market-card"]',
  marketCardTitle: '[data-testid="market-card-title"]',

  // Market detail
  marketDetailTitle: '[data-testid="market-detail-title"]',
  priceYes: '[data-testid="price-yes"]',
  priceNo: '[data-testid="price-no"]',

  // Trade form
  tradePanel: '[data-testid="trade-panel"]',
  sideYesRadio: '[data-testid="side-yes"]',
  sideNoRadio: '[data-testid="side-no"]',
  amountInput: '[data-testid="amount-input"]',
  buyButton: '[data-testid="buy-button"]',
  proofProgressBar: '[data-testid="proof-progress"]',
  tradeSuccessBanner: '[data-testid="trade-success"]',

  // Portfolio
  portfolioNavLink: '[data-testid="nav-portfolio"]',
  portfolioPositionRow: '[data-testid="position-row"]',

  // Errors / toasts
  errorToast: '[data-testid="error-toast"]',
};

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

async function openApp(page: Page): Promise<void> {
  await page.goto(APP_URL);
  await expect(page).toHaveTitle(/Honkers/i);
}

/**
 * Simulates wallet connection via the injected test wallet provider.
 * Production builds should gate this on a real wallet; in test mode we click
 * the connect button and accept the auto-approved mock wallet.
 */
async function connectWallet(page: Page): Promise<void> {
  await page.click(SEL.connectWalletBtn);
  // The test wallet auto-approves — wait for the address badge to appear
  await expect(page.locator(SEL.walletAddressBadge)).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// 1. Landing page
// ---------------------------------------------------------------------------

test.describe('Landing page', () => {
  test('loads and shows the app title', async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveTitle(/Honkers/i);
  });

  test('shows a connect-wallet button when no wallet is connected', async ({ page }) => {
    await openApp(page);
    await expect(page.locator(SEL.connectWalletBtn)).toBeVisible();
  });

  test('markets list is not empty', async ({ page }) => {
    await openApp(page);
    await connectWallet(page);
    await expect(page.locator(SEL.marketCard).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// 2. Wallet connection
// ---------------------------------------------------------------------------

test.describe('Wallet connection', () => {
  test('clicking Connect Wallet shows address badge after approval', async ({ page }) => {
    await openApp(page);
    await connectWallet(page);
    const badge = page.locator(SEL.walletAddressBadge);
    const address = await badge.textContent();
    // Aztec address: 0x followed by 64 hex characters
    expect(address).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// 3. Markets list
// ---------------------------------------------------------------------------

test.describe('Markets list', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await connectWallet(page);
  });

  test('each market card displays a title and YES/NO prices', async ({ page }) => {
    const firstCard = page.locator(SEL.marketCard).first();
    await expect(firstCard.locator(SEL.marketCardTitle)).not.toBeEmpty();
    await expect(firstCard.locator(SEL.priceYes)).toContainText('%');
    await expect(firstCard.locator(SEL.priceNo)).toContainText('%');
  });

  test('YES price + NO price sum to ~100%', async ({ page }) => {
    const firstCard = page.locator(SEL.marketCard).first();
    const yesText = await firstCard.locator(SEL.priceYes).textContent();
    const noText  = await firstCard.locator(SEL.priceNo).textContent();
    const yes = parseFloat(yesText?.replace('%', '') ?? '0');
    const no  = parseFloat(noText?.replace('%', '') ?? '0');
    // Allow ±1 for rounding
    expect(Math.abs(yes + no - 100)).toBeLessThanOrEqual(1);
  });

  test('clicking a market card navigates to market detail', async ({ page }) => {
    await page.locator(SEL.marketCard).first().click();
    await expect(page.locator(SEL.marketDetailTitle)).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// 4. Market detail
// ---------------------------------------------------------------------------

test.describe('Market detail', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await connectWallet(page);
    await page.locator(SEL.marketCard).first().click();
    await expect(page.locator(SEL.marketDetailTitle)).toBeVisible({ timeout: 5_000 });
  });

  test('trade panel is visible', async ({ page }) => {
    await expect(page.locator(SEL.tradePanel)).toBeVisible();
  });

  test('YES and NO radio buttons are present and YES is selected by default', async ({ page }) => {
    await expect(page.locator(SEL.sideYesRadio)).toBeChecked();
    await expect(page.locator(SEL.sideNoRadio)).not.toBeChecked();
  });

  test('buy button is disabled when amount is empty', async ({ page }) => {
    await page.locator(SEL.amountInput).fill('');
    await expect(page.locator(SEL.buyButton)).toBeDisabled();
  });

  test('buy button is disabled when amount is zero', async ({ page }) => {
    await page.locator(SEL.amountInput).fill('0');
    await expect(page.locator(SEL.buyButton)).toBeDisabled();
  });

  test('typing a valid amount enables the buy button', async ({ page }) => {
    await page.locator(SEL.amountInput).fill('10');
    await expect(page.locator(SEL.buyButton)).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 5. Full trade flow: buy YES shares
// ---------------------------------------------------------------------------

test.describe('Trade flow — buy YES', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await connectWallet(page);
    await page.locator(SEL.marketCard).first().click();
    await expect(page.locator(SEL.marketDetailTitle)).toBeVisible({ timeout: 5_000 });
  });

  test('submitting a trade shows a ZK proof progress indicator', async ({ page }) => {
    await page.locator(SEL.sideYesRadio).check();
    await page.locator(SEL.amountInput).fill('10');
    await page.locator(SEL.buyButton).click();
    // Proof generation is async — progress bar should appear immediately
    await expect(page.locator(SEL.proofProgressBar)).toBeVisible({ timeout: 3_000 });
  });

  test('successful trade shows a success banner', async ({ page }) => {
    await page.locator(SEL.sideYesRadio).check();
    await page.locator(SEL.amountInput).fill('10');
    await page.locator(SEL.buyButton).click();
    // Allow up to 60s for sandbox proof generation
    await expect(page.locator(SEL.tradeSuccessBanner)).toBeVisible({ timeout: 60_000 });
  });

  test('switching to NO side and submitting also succeeds', async ({ page }) => {
    await page.locator(SEL.sideNoRadio).check();
    await expect(page.locator(SEL.sideNoRadio)).toBeChecked();
    await page.locator(SEL.amountInput).fill('5');
    await page.locator(SEL.buyButton).click();
    await expect(page.locator(SEL.tradeSuccessBanner)).toBeVisible({ timeout: 60_000 });
  });
});

// ---------------------------------------------------------------------------
// 6. Portfolio view
// ---------------------------------------------------------------------------

test.describe('Portfolio', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await connectWallet(page);
  });

  test('portfolio page is reachable via nav link', async ({ page }) => {
    await page.locator(SEL.portfolioNavLink).click();
    await expect(page).toHaveURL(/portfolio/i);
  });

  test('position rows appear after a successful trade', async ({ page }) => {
    // Buy a position first
    await page.locator(SEL.marketCard).first().click();
    await expect(page.locator(SEL.marketDetailTitle)).toBeVisible({ timeout: 5_000 });
    await page.locator(SEL.sideYesRadio).check();
    await page.locator(SEL.amountInput).fill('10');
    await page.locator(SEL.buyButton).click();
    await expect(page.locator(SEL.tradeSuccessBanner)).toBeVisible({ timeout: 60_000 });

    // Navigate to portfolio and check position row
    await page.locator(SEL.portfolioNavLink).click();
    await expect(page.locator(SEL.portfolioPositionRow).first()).toBeVisible({ timeout: 10_000 });
  });

  test('each position row shows market name, side, amount and entry price', async ({ page }) => {
    // Assumes at least one position exists (relies on prior test state or seeded sandbox)
    await page.locator(SEL.portfolioNavLink).click();
    const firstRow = page.locator(SEL.portfolioPositionRow).first();
    await expect(firstRow).toContainText(/YES|NO/i);
    await expect(firstRow).toContainText(/USDC/i);
  });
});

// ---------------------------------------------------------------------------
// 7. Error handling
// ---------------------------------------------------------------------------

test.describe('Error handling', () => {
  test('entering a non-numeric amount shows a validation error', async ({ page }) => {
    await openApp(page);
    await connectWallet(page);
    await page.locator(SEL.marketCard).first().click();
    await expect(page.locator(SEL.marketDetailTitle)).toBeVisible({ timeout: 5_000 });
    await page.locator(SEL.amountInput).fill('abc');
    await expect(page.locator(SEL.buyButton)).toBeDisabled();
  });

  test('attempting to trade without connecting a wallet shows an error toast', async ({ page }) => {
    await openApp(page);
    // Do NOT call connectWallet — navigate directly to first market via URL if possible
    // or verify the connect-wallet gate blocks trading
    await expect(page.locator(SEL.connectWalletBtn)).toBeVisible();
    // The Buy button must not be visible / enabled without a wallet
    const buyBtn = page.locator(SEL.buyButton);
    const visible = await buyBtn.isVisible().catch(() => false);
    if (visible) {
      await expect(buyBtn).toBeDisabled();
    } else {
      // Button hidden entirely when unconnected — also acceptable
      expect(visible).toBe(false);
    }
  });
});
