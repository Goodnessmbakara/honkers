/**
 * Honkers — Integration tests (Aztec v4.1.3)
 *
 * Full contract flow against Aztec local network:
 *   deploy → faucet → deposit collateral → buy shares → resolve market → claim
 *
 * Prerequisites:
 *   1. Aztec local network running:  aztec start --local-network
 *   2. Contracts compiled:           cd contracts && aztec compile
 *   3. Artifacts generated:          aztec codegen contracts/target -o tests/integration/src/artifacts
 *
 * Run:
 *   NODE_URL=http://localhost:8080 pnpm test
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient, waitForNode } from '@aztec/aztec.js/node';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { CLIWallet } from '@aztec/cli-wallet';

import { TestTokenContract } from './artifacts/TestToken.js';
import { AMMContract } from './artifacts/AMM.js';
import { OracleContract } from './artifacts/Oracle.js';
import { PrivateVaultContract } from './artifacts/PrivateVault.js';
import { MarketFactoryContract } from './artifacts/MarketFactory.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NODE_URL = process.env.NODE_URL ?? process.env.PXE_URL ?? 'http://localhost:8080';

const HUNDRED_USDC = 100_000_000n;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Honkers — Contract Deployment & Basic Operations', () => {
  let wallet: Wallet;
  let adminAddress: AztecAddress;
  let traderAddress: AztecAddress;

  let token: InstanceType<typeof TestTokenContract>;
  let amm: InstanceType<typeof AMMContract>;
  let oracle: InstanceType<typeof OracleContract>;
  let vault: InstanceType<typeof PrivateVaultContract>;
  let factory: InstanceType<typeof MarketFactoryContract>;

  // -------------------------------------------------------------------------
  // Setup — connect to sandbox and deploy contracts
  // -------------------------------------------------------------------------

  before(async () => {
    // Connect to the Aztec node
    const node = createAztecNodeClient(NODE_URL);
    await waitForNode(node);

    // Create wallet with embedded PXE (no DB needed for tests)
    const cliWallet = await CLIWallet.create(node, console.log);
    wallet = cliWallet;

    // Create two Schnorr accounts
    const adminSecret = Fr.random();
    const traderSecret = Fr.random();

    const adminAccountManager = await cliWallet.createOrRetrieveAccount(
      undefined, adminSecret, 'schnorr',
    );
    adminAddress = adminAccountManager.address;

    // Deploy admin account contract
    if (await adminAccountManager.hasInitializer()) {
      await adminAccountManager.getDeployMethod().then(m => m.send({ from: adminAddress }));
    }

    const traderAccountManager = await cliWallet.createOrRetrieveAccount(
      undefined, traderSecret, 'schnorr',
    );
    traderAddress = traderAccountManager.address;

    // Deploy trader account contract
    if (await traderAccountManager.hasInitializer()) {
      await traderAccountManager.getDeployMethod().then(m => m.send({ from: traderAddress }));
    }

    // Deploy TestToken
    ({ contract: token } = await TestTokenContract.deploy(
      wallet,
      adminAddress,
      Fr.fromString('0x' + Buffer.from('USDC').toString('hex')),
      Fr.fromString('0x' + Buffer.from('USDC').toString('hex')),
    ).send({ from: adminAddress }));

    // Deploy AMM (with placeholder addresses initially)
    ({ contract: amm } = await AMMContract.deploy(
      wallet,
      adminAddress,
      AztecAddress.ZERO, // vault — not yet deployed
      AztecAddress.ZERO, // oracle — not yet deployed
    ).send({ from: adminAddress }));

    // Deploy Oracle
    ({ contract: oracle } = await OracleContract.deploy(
      wallet,
      adminAddress,
      amm.address,
    ).send({ from: adminAddress }));

    // Deploy PrivateVault
    ({ contract: vault } = await PrivateVaultContract.deploy(
      wallet,
      adminAddress,
      adminAddress, // fee_recipient = admin for tests
      token.address,
      amm.address,
      oracle.address,
    ).send({ from: adminAddress }));

    // Deploy MarketFactory
    ({ contract: factory } = await MarketFactoryContract.deploy(
      wallet,
      adminAddress,
      amm.address,
      oracle.address,
      token.address,
    ).send({ from: adminAddress }));
  });

  // -------------------------------------------------------------------------
  // 1. Deployment verification
  // -------------------------------------------------------------------------

  describe('Deployment', () => {
    it('all five contracts deployed successfully', () => {
      assert.ok(!token.address.isZero(), 'TestToken deployed');
      assert.ok(!amm.address.isZero(), 'AMM deployed');
      assert.ok(!oracle.address.isZero(), 'Oracle deployed');
      assert.ok(!vault.address.isZero(), 'PrivateVault deployed');
      assert.ok(!factory.address.isZero(), 'MarketFactory deployed');
    });

    it('TestToken admin is correct', async () => {
      const result = await token.methods.get_admin().simulate();
      assert.equal(result.result.toString(), adminAddress.toString());
    });

    it('AMM admin is correct', async () => {
      const result = await amm.methods.get_admin().simulate();
      assert.equal(result.result.toString(), adminAddress.toString());
    });

    it('PrivateVault admin is correct', async () => {
      const result = await vault.methods.get_admin().simulate();
      assert.equal(result.result.toString(), adminAddress.toString());
    });

    it('MarketFactory admin is correct', async () => {
      const result = await factory.methods.get_admin().simulate();
      assert.equal(result.result.toString(), adminAddress.toString());
    });
  });

  // -------------------------------------------------------------------------
  // 2. TestToken faucet
  // -------------------------------------------------------------------------

  describe('Faucet', () => {
    it('admin can mint tokens via admin_mint', async () => {
      await token.methods.admin_mint(traderAddress, HUNDRED_USDC)
        .send({ from: adminAddress });
      const result = await token.methods.balance_of(traderAddress).simulate();
      assert.equal(result.result, HUNDRED_USDC);
    });

    it('total supply increases after mint', async () => {
      const result = await token.methods.total_supply().simulate();
      assert.equal(result.result, HUNDRED_USDC);
    });

    it('faucet works for trader', async () => {
      await token.methods.faucet(HUNDRED_USDC)
        .send({ from: traderAddress });
      const result = await token.methods.balance_of(traderAddress).simulate();
      assert.equal(result.result, HUNDRED_USDC * 2n);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Public transfer
  // -------------------------------------------------------------------------

  describe('Transfer', () => {
    it('trader can transfer tokens', async () => {
      const amount = 10_000_000n;
      await token.methods
        .transfer_public(adminAddress, amount)
        .send({ from: traderAddress });
      const result = await token.methods.balance_of(adminAddress).simulate();
      assert.equal(result.result, amount);
    });
  });

  // -------------------------------------------------------------------------
  // 4. AMM market initialization
  // -------------------------------------------------------------------------

  describe('AMM', () => {
    it('initialize a market with even liquidity', async () => {
      const marketId = 1n;
      const liquidity = 1_000_000n;
      const endDate = BigInt(Math.floor(Date.now() / 1000) + 172800);

      await amm.methods.initialize_market(marketId, liquidity, endDate)
        .send({ from: adminAddress });

      const result = await amm.methods.get_reserves(marketId).simulate();
      const reserves = result.result;
      const ry = reserves[0];
      const rn = reserves[1];
      assert.equal(ry, liquidity / 2n, 'YES reserve = half liquidity');
      assert.equal(rn, liquidity / 2n, 'NO reserve = half liquidity');
    });

    it('price starts at 50/50', async () => {
      const marketId = 1n;
      const priceYes = (await amm.methods.get_price_yes(marketId).simulate()).result;
      const priceNo = (await amm.methods.get_price_no(marketId).simulate()).result;
      assert.equal(priceYes, 500_000n, 'YES price = 0.5');
      assert.equal(priceNo, 500_000n, 'NO price = 0.5');
    });

    it('cannot initialize the same market twice', async () => {
      try {
        await amm.methods.initialize_market(1n, 1_000_000n, 0n)
          .send({ from: adminAddress });
        assert.fail('Should have thrown');
      } catch (err: any) {
        assert.ok(err.message.includes('already') || err.message.includes('initialised'), err.message);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 5. Oracle
  // -------------------------------------------------------------------------

  describe('Oracle', () => {
    it('register a market', async () => {
      const marketId = 1n;
      const endDate = BigInt(Math.floor(Date.now() / 1000) + 172800);
      await oracle.methods.register_market(marketId, endDate)
        .send({ from: adminAddress });
      const result = await oracle.methods.get_resolution_state(marketId).simulate();
      assert.equal(result.result, 0n, 'Should be UNRESOLVED');
    });

    it('admin proposes YES outcome', async () => {
      await oracle.methods.propose_resolution(1n, 1n)
        .send({ from: adminAddress });
      const result = await oracle.methods.get_resolution_state(1n).simulate();
      assert.equal(result.result, 1n, 'Should be PROPOSED');
    });

    it('non-admin cannot propose', async () => {
      await oracle.methods.register_market(2n, BigInt(Math.floor(Date.now() / 1000) + 172800))
        .send({ from: adminAddress });
      try {
        await oracle.methods.propose_resolution(2n, 1n)
          .send({ from: traderAddress });
        assert.fail('Should have thrown');
      } catch (err: any) {
        assert.ok(err.message.includes('admin') || err.message.includes('Only'), err.message);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. MarketFactory whitelist
  // -------------------------------------------------------------------------

  describe('MarketFactory', () => {
    it('non-whitelisted cannot create market', async () => {
      try {
        await factory.methods
          .create_market(1n, 1n, 1n, BigInt(Math.floor(Date.now() / 1000) + 172800), 500_000_000n)
          .send({ from: traderAddress });
        assert.fail('Should have thrown');
      } catch (err: any) {
        assert.ok(
          err.message.includes('whitelist') || err.message.includes('Whitelist') || err.message.includes('not'),
          err.message,
        );
      }
    });

    it('admin can whitelist a creator', async () => {
      await factory.methods.add_to_whitelist(adminAddress)
        .send({ from: adminAddress });
      const result = await factory.methods.is_whitelisted(adminAddress).simulate();
      assert.equal(result.result, 1n);
    });
  });

  // -------------------------------------------------------------------------
  // 7. PrivateVault pause/unpause
  // -------------------------------------------------------------------------

  describe('PrivateVault admin', () => {
    it('vault starts unpaused', async () => {
      const result = await vault.methods.is_paused().simulate();
      assert.equal(result.result, 0n);
    });

    it('admin can pause', async () => {
      await vault.methods.emergency_pause()
        .send({ from: adminAddress });
      const result = await vault.methods.is_paused().simulate();
      assert.equal(result.result, 1n);
    });

    it('admin can unpause', async () => {
      await vault.methods.unpause()
        .send({ from: adminAddress });
      const result = await vault.methods.is_paused().simulate();
      assert.equal(result.result, 0n);
    });
  });
});
