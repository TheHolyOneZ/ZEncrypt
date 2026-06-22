

pub mod aead;
pub mod kdf;
pub mod pubkey;
pub mod stream;

use zeroize::{Zeroize, ZeroizeOnDrop};


#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct Key(pub [u8; 32]);

impl Key {
    #[allow(dead_code)]
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}
