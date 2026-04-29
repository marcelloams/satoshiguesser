import { deriveAll, randomPrivKey, bytesToHex } from './crypto.js';
import { checkHash160s } from './wallets.js';

/**
 * Run one spin: roll a key, derive both address forms, check against the
 * Satoshi set. Pure data; no DOM, no animation. The UI layer animates
 * around this.
 *
 * In dev-win mode the caller can pass a forced result to short-circuit
 * the random roll and surface the polished win UI without touching code.
 */
export async function spin({ devWin = null } = {}) {
  if (devWin) {
    return {
      win: true,
      privKey: devWin.privKey,
      privKeyHex: bytesToHex(devWin.privKey),
      derived: deriveAll(devWin.privKey),
      match: devWin.match, // {hash160, balanceSats, address}
    };
  }

  const privKey = randomPrivKey();
  const derived = deriveAll(privKey);
  const candidates = [derived.hash160Uncompressed, derived.hash160Compressed];
  const hit = await checkHash160s(candidates);

  return {
    win: hit !== null,
    privKey,
    privKeyHex: bytesToHex(privKey),
    derived,
    match: hit, // null on miss
  };
}
