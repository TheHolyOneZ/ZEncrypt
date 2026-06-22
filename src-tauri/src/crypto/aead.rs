
use aes_gcm::{Aes256Gcm, aead::{Aead, KeyInit, Payload as AesPayload}};
use chacha20poly1305::{ChaCha20Poly1305, aead::Payload as ChaPayload};
use subtle::ConstantTimeEq;

use super::Key;


#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Cipher {
    ChaCha20Poly1305 = 0x01,
    Aes256Gcm = 0x02,
}

impl Cipher {
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0x01 => Some(Self::ChaCha20Poly1305),
            0x02 => Some(Self::Aes256Gcm),
            _ => None,
        }
    }

    pub fn to_byte(self) -> u8 {
        self as u8
    }


    pub fn seal(&self, key: &Key, nonce: &[u8; 12], aad: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
        match self {
            Cipher::ChaCha20Poly1305 => {
                let cipher = ChaCha20Poly1305::new(key.0.as_ref().into());
                cipher
                    .encrypt(nonce.into(), ChaPayload { msg: plaintext, aad })
                    .map_err(|_| "encryption failed".into())
            }
            Cipher::Aes256Gcm => {
                let cipher = Aes256Gcm::new(key.0.as_ref().into());
                cipher
                    .encrypt(nonce.into(), AesPayload { msg: plaintext, aad })
                    .map_err(|_| "encryption failed".into())
            }
        }
    }


    pub fn open(&self, key: &Key, nonce: &[u8; 12], aad: &[u8], ciphertext_and_tag: &[u8]) -> Result<Vec<u8>, String> {
        if ciphertext_and_tag.len() < 16 {
            return Err("ciphertext too short".into());
        }
        match self {
            Cipher::ChaCha20Poly1305 => {
                let cipher = ChaCha20Poly1305::new(key.0.as_ref().into());
                cipher
                    .decrypt(nonce.into(), ChaPayload { msg: ciphertext_and_tag, aad })
                    .map_err(|_| "authentication failed".into())
            }
            Cipher::Aes256Gcm => {
                let cipher = Aes256Gcm::new(key.0.as_ref().into());
                cipher
                    .decrypt(nonce.into(), AesPayload { msg: ciphertext_and_tag, aad })
                    .map_err(|_| "authentication failed".into())
            }
        }
    }
}


pub fn chunk_nonce(base: &[u8; 12], index: u32, is_last: bool) -> [u8; 12] {
    let mut n = *base;
    let idx_bytes = index.to_le_bytes();
    n[8] ^= idx_bytes[0];
    n[9] ^= idx_bytes[1];
    n[10] ^= idx_bytes[2];
    n[11] ^= idx_bytes[3];
    if is_last {
        n[11] |= 0x80;
    }
    n
}


pub fn roots_equal(a: &[u8; 32], b: &[u8; 32]) -> bool {
    a.ct_eq(b).into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::Key;

    fn test_key() -> Key {
        Key([0x42u8; 32])
    }

    fn test_nonce() -> [u8; 12] {
        [0x11u8; 12]
    }

    #[test]
    fn chacha_roundtrip() {
        let key = test_key();
        let nonce = test_nonce();
        let aad = b"header bytes";
        let plaintext = b"hello, world";
        let ct = Cipher::ChaCha20Poly1305.seal(&key, &nonce, aad, plaintext).unwrap();
        let pt = Cipher::ChaCha20Poly1305.open(&key, &nonce, aad, &ct).unwrap();
        assert_eq!(pt, plaintext);
    }

    #[test]
    fn aes_gcm_roundtrip() {
        let key = test_key();
        let nonce = test_nonce();
        let aad = b"header bytes";
        let plaintext = b"hello, AES-GCM";
        let ct = Cipher::Aes256Gcm.seal(&key, &nonce, aad, plaintext).unwrap();
        let pt = Cipher::Aes256Gcm.open(&key, &nonce, aad, &ct).unwrap();
        assert_eq!(pt, plaintext);
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let key = test_key();
        let nonce = test_nonce();
        let aad = b"header";
        let mut ct = Cipher::ChaCha20Poly1305.seal(&key, &nonce, aad, b"secret").unwrap();
        ct[0] ^= 0xFF;
        assert!(Cipher::ChaCha20Poly1305.open(&key, &nonce, aad, &ct).is_err());
    }

    #[test]
    fn wrong_aad_fails() {
        let key = test_key();
        let nonce = test_nonce();
        let ct = Cipher::ChaCha20Poly1305.seal(&key, &nonce, b"real aad", b"data").unwrap();
        assert!(Cipher::ChaCha20Poly1305.open(&key, &nonce, b"wrong aad", &ct).is_err());
    }

    #[test]
    fn chunk_nonces_are_distinct() {
        let base = [0u8; 12];
        let n0 = chunk_nonce(&base, 0, false);
        let n1 = chunk_nonce(&base, 1, false);
        let n_last = chunk_nonce(&base, 0, true);
        let n_max = chunk_nonce(&base, u32::MAX >> 1, false);
        assert_ne!(n0, n1);
        assert_ne!(n0, n_last);
        assert_ne!(n0, n_max);
        assert_ne!(n1, n_last);
    }

    #[test]
    fn last_chunk_flag_changes_nonce() {
        let base = [0x55u8; 12];
        let n = chunk_nonce(&base, 42, false);
        let n_last = chunk_nonce(&base, 42, true);
        assert_ne!(n, n_last);
        assert_ne!(n[11] & 0x80, n_last[11] & 0x80);
    }
}
