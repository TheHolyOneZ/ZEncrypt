

use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Key as ChaChaKey, Nonce,
};
use rand::RngCore;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroize;

use crate::crypto::Key;

pub const PUBKEY_BLOCK_LEN: usize = 32 + 8 + 32 + 16;
pub const FILE_KEY_LEN: usize = 32;
pub const RECIPIENT_FP_LEN: usize = 8;


pub const PUBKEY_EXT: &str = "zkey-pub";

pub const PRIVKEY_EXT: &str = "zkey-priv";


const PUBKEY_MAGIC: &[u8; 8] = b"ZENCPUB1";
const PRIVKEY_MAGIC: &[u8; 8] = b"ZENCPRV1";

pub fn generate_keypair() -> (StaticSecret, PublicKey) {
    let sk = StaticSecret::random_from_rng(rand::thread_rng());
    let pk = PublicKey::from(&sk);
    (sk, pk)
}

pub fn fingerprint(pk: &PublicKey) -> [u8; RECIPIENT_FP_LEN] {
    let h = blake3::hash(pk.as_bytes());
    let b = h.as_bytes();
    [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]
}

pub fn fingerprint_hex(pk: &PublicKey) -> String {
    fingerprint(pk).iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn write_pubkey_file(pk: &PublicKey, bytes: &mut Vec<u8>) {
    bytes.extend_from_slice(PUBKEY_MAGIC);
    bytes.extend_from_slice(pk.as_bytes());
}

pub fn write_privkey_file(sk: &StaticSecret, bytes: &mut Vec<u8>) {
    bytes.extend_from_slice(PRIVKEY_MAGIC);
    bytes.extend_from_slice(&sk.to_bytes());
}

pub fn read_pubkey_file(data: &[u8]) -> Result<PublicKey, String> {
    if data.len() != 8 + 32 || &data[..8] != PUBKEY_MAGIC {
        return Err("not a valid ZEncrypt public key file".into());
    }
    let mut k = [0u8; 32];
    k.copy_from_slice(&data[8..40]);
    Ok(PublicKey::from(k))
}

pub fn read_privkey_file(data: &[u8]) -> Result<StaticSecret, String> {
    if data.len() != 8 + 32 || &data[..8] != PRIVKEY_MAGIC {
        return Err("not a valid ZEncrypt private key file".into());
    }
    let mut k = [0u8; 32];
    k.copy_from_slice(&data[8..40]);
    Ok(StaticSecret::from(k))
}


pub fn wrap_for_recipient(recipient_pk: &PublicKey) -> Result<(Key, Vec<u8>), String> {
    let mut file_key_bytes = [0u8; FILE_KEY_LEN];
    rand::thread_rng().fill_bytes(&mut file_key_bytes);

    let (eph_sk, eph_pk) = generate_keypair();
    let shared = eph_sk.diffie_hellman(recipient_pk);

    let wrap_key = blake3::keyed_hash(shared.as_bytes(), b"zenc-pubkey-wrap-v1");
    let wrap_nonce_hash = blake3::keyed_hash(shared.as_bytes(), b"zenc-pubkey-nonce-v1");
    let nonce = Nonce::from_slice(&wrap_nonce_hash.as_bytes()[..12]);

    let mut aad = Vec::with_capacity(64);
    aad.extend_from_slice(eph_pk.as_bytes());
    aad.extend_from_slice(recipient_pk.as_bytes());

    let cipher = ChaCha20Poly1305::new(ChaChaKey::from_slice(wrap_key.as_bytes()));
    let ct = cipher
        .encrypt(nonce, Payload { msg: &file_key_bytes, aad: &aad })
        .map_err(|_| "wrap encryption failed".to_string())?;

    let mut block = Vec::with_capacity(PUBKEY_BLOCK_LEN);
    block.extend_from_slice(eph_pk.as_bytes());
    block.extend_from_slice(&fingerprint(recipient_pk));
    block.extend_from_slice(&ct);
    debug_assert_eq!(block.len(), PUBKEY_BLOCK_LEN);

    let key = Key(file_key_bytes);
    file_key_bytes.zeroize();
    Ok((key, block))
}


pub fn unwrap_with_private_key(block: &[u8], recipient_sk: &StaticSecret) -> Result<Key, String> {
    if block.len() != PUBKEY_BLOCK_LEN {
        return Err("pubkey block has wrong length".into());
    }
    let mut eph_pk_bytes = [0u8; 32];
    eph_pk_bytes.copy_from_slice(&block[0..32]);
    let eph_pk = PublicKey::from(eph_pk_bytes);
    let ct = &block[40..88];

    let shared = recipient_sk.diffie_hellman(&eph_pk);
    let wrap_key = blake3::keyed_hash(shared.as_bytes(), b"zenc-pubkey-wrap-v1");
    let wrap_nonce_hash = blake3::keyed_hash(shared.as_bytes(), b"zenc-pubkey-nonce-v1");
    let nonce = Nonce::from_slice(&wrap_nonce_hash.as_bytes()[..12]);

    let recipient_pk = PublicKey::from(recipient_sk);
    let mut aad = Vec::with_capacity(64);
    aad.extend_from_slice(eph_pk.as_bytes());
    aad.extend_from_slice(recipient_pk.as_bytes());

    let cipher = ChaCha20Poly1305::new(ChaChaKey::from_slice(wrap_key.as_bytes()));
    let pt = cipher
        .decrypt(nonce, Payload { msg: ct, aad: &aad })
        .map_err(|_| "wrong private key for this recipient".to_string())?;

    if pt.len() != FILE_KEY_LEN {
        return Err("unwrapped key has wrong length".into());
    }
    let mut k = [0u8; FILE_KEY_LEN];
    k.copy_from_slice(&pt);
    Ok(Key(k))
}


pub fn recipient_fingerprint_hex_from_block(block: &[u8]) -> String {
    if block.len() < 40 {
        return String::new();
    }
    block[32..40].iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keypair_file_roundtrip() {
        let (sk, pk) = generate_keypair();
        let mut pub_buf = Vec::new();
        write_pubkey_file(&pk, &mut pub_buf);
        let mut priv_buf = Vec::new();
        write_privkey_file(&sk, &mut priv_buf);

        let pk2 = read_pubkey_file(&pub_buf).unwrap();
        assert_eq!(pk.as_bytes(), pk2.as_bytes());
        let sk2 = read_privkey_file(&priv_buf).unwrap();
        assert_eq!(sk.to_bytes(), sk2.to_bytes());
    }

    #[test]
    fn wrap_unwrap_roundtrip() {
        let (sk, pk) = generate_keypair();
        let (key, block) = wrap_for_recipient(&pk).unwrap();
        let key2 = unwrap_with_private_key(&block, &sk).unwrap();
        assert_eq!(key.0, key2.0);
    }

    #[test]
    fn wrong_key_rejected() {
        let (_sk_a, pk_a) = generate_keypair();
        let (sk_b, _pk_b) = generate_keypair();
        let (_, block) = wrap_for_recipient(&pk_a).unwrap();
        assert!(unwrap_with_private_key(&block, &sk_b).is_err());
    }

    #[test]
    fn fingerprint_is_deterministic() {
        let pk_bytes = [0x42u8; 32];
        let pk = PublicKey::from(pk_bytes);
        let a = fingerprint_hex(&pk);
        let b = fingerprint_hex(&pk);
        assert_eq!(a, b);
        assert_eq!(a.len(), 16);
    }

    #[test]
    fn tampered_block_fails() {
        let (sk, pk) = generate_keypair();
        let (_, mut block) = wrap_for_recipient(&pk).unwrap();
        block[50] ^= 1;
        assert!(unwrap_with_private_key(&block, &sk).is_err());
    }

    #[test]
    fn bad_magic_rejected() {
        let mut buf = vec![0u8; 40];
        buf[0] = b'X';
        assert!(read_pubkey_file(&buf).is_err());
        assert!(read_privkey_file(&buf).is_err());
    }
}
