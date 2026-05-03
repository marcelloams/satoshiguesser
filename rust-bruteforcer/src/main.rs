use std::fs;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use rayon::prelude::*;
use secp256k1::{Secp256k1, SecretKey};
use sha2::{Sha256, Digest};
use ripemd::Ripemd160;
use rand::thread_rng;

fn hash_indices(item: &[u8], m: u32, k: u32) -> Vec<u32> {
    let mut hasher = Sha256::new();
    hasher.update(item);
    let h = hasher.finalize();

    let h1 = u32::from_le_bytes(h[0..4].try_into().unwrap());
    let h2 = u32::from_le_bytes(h[4..8].try_into().unwrap());

    let mut out = Vec::with_capacity(k as usize);
    for i in 0..k {
        let h2_mul = i.wrapping_mul(h2);
        let val = h1.wrapping_add(h2_mul);
        out.push(val % m);
    }
    out
}

struct BloomFilter {
    m: u32,
    k: u32,
    bits: Vec<u8>,
}

impl BloomFilter {
    fn deserialize(buf: &[u8]) -> Self {
        assert_eq!(&buf[0..4], b"BLM1");
        let m = u32::from_le_bytes(buf[8..12].try_into().unwrap());
        let k = buf[12] as u32;
        let bits = buf[16..16 + (m / 8) as usize].to_vec();
        BloomFilter { m, k, bits }
    }

    fn has(&self, item: &[u8]) -> bool {
        let indices = hash_indices(item, self.m, self.k);
        for bit in indices {
            let byte_idx = (bit >> 3) as usize;
            let bit_idx = bit & 7;
            if (self.bits[byte_idx] & (1 << bit_idx)) == 0 {
                return false;
            }
        }
        true
    }
}

struct WalletTable {
    bytes: Vec<u8>,
    count: u32,
}

impl WalletTable {
    fn new(buf: &[u8]) -> Self {
        assert_eq!(&buf[0..4], b"WHB1");
        let count = u32::from_le_bytes(buf[4..8].try_into().unwrap());
        WalletTable { bytes: buf.to_vec(), count }
    }

    fn lookup(&self, hash160: &[u8]) -> Option<u64> {
        let mut lo = 0i64;
        let mut hi = (self.count as i64) - 1;

        while lo <= hi {
            let mid = (lo + hi) / 2;
            let off = 8 + (mid as usize) * 28;
            let target = &self.bytes[off..off + 20];
            
            match target.cmp(hash160) {
                std::cmp::Ordering::Equal => {
                    let mut b = [0u8; 8];
                    b.copy_from_slice(&self.bytes[off + 20..off + 28]);
                    return Some(u64::from_le_bytes(b));
                }
                std::cmp::Ordering::Less => lo = mid + 1,
                std::cmp::Ordering::Greater => hi = mid - 1,
            }
        }
        None
    }
}

fn hash160(bytes: &[u8]) -> [u8; 20] {
    let mut sha256 = Sha256::new();
    sha256.update(bytes);
    let sha_res = sha256.finalize();

    let mut ripemd = Ripemd160::new();
    ripemd.update(sha_res);
    let mut out = [0u8; 20];
    out.copy_from_slice(&ripemd.finalize());
    out
}

fn main() {
    println!("Loading binary databases...");
    
    // We expect to be run from the rust-bruteforcer directory
    let bloom_bytes = fs::read("../public/data/satoshi-bloom.bin")
        .expect("Failed to read satoshi-bloom.bin. Are you running this from the rust-bruteforcer directory?");
    let table_bytes = fs::read("../public/data/satoshi-wallets.bin")
        .expect("Failed to read satoshi-wallets.bin.");

    let bloom = Arc::new(BloomFilter::deserialize(&bloom_bytes));
    let table = Arc::new(WalletTable::new(&table_bytes));

    println!("Bloom bits: {}, k: {}", bloom.m, bloom.k);
    println!("Wallets loaded: {}", table.count);

    let counter = Arc::new(AtomicUsize::new(0));
    let counter_clone = counter.clone();

    // Spawn a thread to print speed every second
    std::thread::spawn(move || {
        let mut last_count = 0;
        let mut last_time = Instant::now();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(1000));
            let current_count = counter_clone.load(Ordering::Relaxed);
            let elapsed = last_time.elapsed().as_secs_f64();
            let sps = (current_count - last_count) as f64 / elapsed;
            println!("Speed: {:.0} guesses / sec", sps);
            last_count = current_count;
            last_time = Instant::now();
        }
    });

    println!("Starting infinite parallel loop on all cores...");
    println!("Watch your CPU usage climb to 100%!");
    
    // rayon::iter::repeat creates an infinite parallel iterator
    rayon::iter::repeat(()).for_each(|_| {
        let secp = Secp256k1::new();
        let mut rng = thread_rng();
        
        // Batch loop to minimize thread overhead
        for _ in 0..10_000 {
            let secret_key = SecretKey::new(&mut rng);
            let public_key_uncompressed = secp256k1::PublicKey::from_secret_key(&secp, &secret_key).serialize_uncompressed();
            let public_key_compressed = secp256k1::PublicKey::from_secret_key(&secp, &secret_key).serialize();

            let h160u = hash160(&public_key_uncompressed);
            let h160c = hash160(&public_key_compressed);

            for h in &[h160u, h160c] {
                if bloom.has(h) {
                    if let Some(balance) = table.lookup(h) {
                        println!("========================================");
                        println!("🎉 MATCH FOUND!");
                        println!("Private key hex: {}", hex::encode(secret_key.secret_bytes()));
                        println!("Balance Sats: {}", balance);
                        println!("========================================");
                        std::process::exit(0);
                    }
                }
            }
        }
        counter.fetch_add(10_000, Ordering::Relaxed);
    });
}
