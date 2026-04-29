import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAll,
  hash160,
  hash160ToAddress,
  privKeyToWif,
  wifToPrivKey,
  parsePrivKey,
  hexToBytes,
  bytesToHex,
} from '../src/game/crypto.js';

// Bitcoin wiki test vector — pubkey → P2PKH address.
test('known pubkey hashes to known P2PKH address', () => {
  const pubUncompressedHex =
    '0450863AD64A87AE8A2FE83C1AF1A8403CB53F53E486D8511DAD8A04887E5B23' +
    '522CD470243453A299FA9E77237716103ABC11A1DF38855ED6F2EE187E9C582BA6';
  const expected = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM';
  const h160 = hash160(hexToBytes(pubUncompressedHex.toLowerCase()));
  assert.equal(hash160ToAddress(h160), expected);
});

// Bitcoin wiki test vector — privkey → uncompressed P2PKH address.
test('known privkey derives to known uncompressed address', () => {
  const privHex =
    '18E14A7B6A307F426A94F8114701E7C8E774E7F9A47E2C2035DB29A206321725';
  const priv = hexToBytes(privHex.toLowerCase());
  const d = deriveAll(priv);
  assert.equal(d.addressUncompressed, '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM');
});

// Bitcoin wiki test vector — WIF encoding (uncompressed).
test('privkey WIF encoding (uncompressed)', () => {
  const privHex =
    '0C28FCA386C7A227600B2FE50B7CAE11EC86D3BF1FBE471BE89827E19D72AA1D';
  const expected = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
  const wif = privKeyToWif(hexToBytes(privHex.toLowerCase()), false);
  assert.equal(wif, expected);
});

// Genesis-block coinbase hash160 -> address sanity check.
test('genesis block coinbase hash160 maps to genesis address', () => {
  const h160 = hexToBytes('62e907b15cbf27d5425399ebf6f0fb50ebb88f18');
  assert.equal(hash160ToAddress(h160), '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
});

test('hex round-trip', () => {
  const bytes = new Uint8Array([0, 1, 0xab, 0xff]);
  assert.equal(bytesToHex(bytes), '0001abff');
  assert.deepEqual(hexToBytes('0001abff'), bytes);
});

test('WIF round-trip (uncompressed)', () => {
  const privHex =
    '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d';
  const wif = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
  const decoded = wifToPrivKey(wif);
  assert.equal(decoded.compressed, false);
  assert.equal(bytesToHex(decoded.privKey), privHex);
});

test('parsePrivKey accepts hex and WIF', () => {
  const hex =
    '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
  const fromHex = parsePrivKey(hex);
  assert.equal(fromHex.format, 'hex');
  assert.equal(bytesToHex(fromHex.privKey), hex);

  const wif = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
  const fromWif = parsePrivKey(wif);
  assert.equal(fromWif.format, 'wif');
  assert.equal(fromWif.compressed, false);
});

test('parsePrivKey rejects bad input', () => {
  assert.throws(() => parsePrivKey('hello world'));
  assert.throws(() => parsePrivKey('deadbeef')); // too short
});
