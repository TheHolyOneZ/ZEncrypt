use std::io::{Read, Write};
use blake3::Hasher as Blake3;

use super::{Key, aead::{Cipher, chunk_nonce, roots_equal}};

const LAST_CHUNK_FLAG: u32 = 0x8000_0000;


pub struct ChunkEncoder<W: Write> {
    cipher: Cipher,
    key: Key,
    base_nonce: [u8; 12],
    aad: Vec<u8>,
    hasher: Blake3,
    writer: W,
    chunk_size: usize,
    index: u32,
    buffer: Vec<u8>,
}

impl<W: Write> ChunkEncoder<W> {
    pub fn new(cipher: Cipher, key: Key, base_nonce: [u8; 12], aad: Vec<u8>, writer: W, chunk_size: usize) -> Self {
        Self {
            cipher,
            key,
            base_nonce,
            aad,
            hasher: Blake3::new(),
            writer,
            chunk_size,
            index: 0,
            buffer: Vec::with_capacity(chunk_size),
        }
    }


    pub fn write_all(&mut self, data: &[u8]) -> Result<(), String> {
        self.hasher.update(data);
        let mut pos = 0;
        while pos < data.len() {
            let space = self.chunk_size - self.buffer.len();
            let take = space.min(data.len() - pos);
            self.buffer.extend_from_slice(&data[pos..pos + take]);
            pos += take;
            if self.buffer.len() == self.chunk_size {
                self.flush_chunk(false)?;
            }
        }
        Ok(())
    }


    pub fn finish(mut self) -> Result<([u8; 32], W), String> {
        let root = *self.hasher.finalize().as_bytes();
        self.flush_chunk(true)?;
        self.writer.write_all(&root).map_err(|e| e.to_string())?;
        Ok((root, self.writer))
    }

    fn flush_chunk(&mut self, is_last: bool) -> Result<(), String> {
        let nonce = chunk_nonce(&self.base_nonce, self.index, is_last);
        let plaintext = std::mem::take(&mut self.buffer);
        let ct = self.cipher.seal(&self.key, &nonce, &self.aad, &plaintext)?;
        let mut len_field = ct.len() as u32;
        if is_last {
            len_field |= LAST_CHUNK_FLAG;
        }
        self.writer.write_all(&len_field.to_le_bytes()).map_err(|e| e.to_string())?;
        self.writer.write_all(&ct).map_err(|e| e.to_string())?;
        self.index += 1;
        Ok(())
    }
}


pub struct ChunkDecoder<R: Read> {
    cipher: Cipher,
    key: Key,
    base_nonce: [u8; 12],
    aad: Vec<u8>,
    hasher: Blake3,
    reader: R,
    index: u32,
    done: bool,
    expected_root: Option<[u8; 32]>,


    bytes_consumed: u64,
}

impl<R: Read> ChunkDecoder<R> {
    pub fn new(cipher: Cipher, key: Key, base_nonce: [u8; 12], aad: Vec<u8>, reader: R) -> Self {
        Self {
            cipher,
            key,
            base_nonce,
            aad,
            hasher: Blake3::new(),
            reader,
            index: 0,
            done: false,
            expected_root: None,
            bytes_consumed: 0,
        }
    }

    pub fn bytes_consumed(&self) -> u64 {
        self.bytes_consumed
    }


    pub fn next_chunk(&mut self) -> Result<Option<Vec<u8>>, String> {
        if self.done {
            return Ok(None);
        }

        let mut len_buf = [0u8; 4];
        self.reader.read_exact(&mut len_buf).map_err(|e| format!("read error: {e}"))?;
        self.bytes_consumed += 4;

        let len_field = u32::from_le_bytes(len_buf);
        let is_last = (len_field & LAST_CHUNK_FLAG) != 0;
        let ct_len = (len_field & !LAST_CHUNK_FLAG) as usize;

        let mut ct = vec![0u8; ct_len];
        self.reader.read_exact(&mut ct).map_err(|e| format!("read error: {e}"))?;
        self.bytes_consumed += ct_len as u64;

        let nonce = chunk_nonce(&self.base_nonce, self.index, is_last);
        let plaintext = self.cipher.open(&self.key, &nonce, &self.aad, &ct)?;

        self.hasher.update(&plaintext);
        self.index += 1;

        if is_last {
            let computed_root = *self.hasher.finalize().as_bytes();
            let mut root_buf = [0u8; 32];
            self.reader
                .read_exact(&mut root_buf)
                .map_err(|e| format!("read error reading BLAKE3 root: {e}"))?;
            self.bytes_consumed += 32;

            if !roots_equal(&computed_root, &root_buf) {
                return Err("integrity check failed: BLAKE3 root mismatch".into());
            }
            self.expected_root = Some(root_buf);
            self.done = true;

            if plaintext.is_empty() {
                return Ok(None);
            }
        }

        Ok(Some(plaintext))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::{Key, aead::Cipher};

    fn roundtrip(data: &[u8], chunk_size: usize) {
        let key = Key([0x77u8; 32]);
        let base_nonce = [0x33u8; 12];
        let aad = b"test-header".to_vec();

        let mut out = Vec::new();
        let mut enc = ChunkEncoder::new(
            Cipher::ChaCha20Poly1305,
            key.clone(),
            base_nonce,
            aad.clone(),
            &mut out,
            chunk_size,
        );
        enc.write_all(data).unwrap();
        let (root, _) = enc.finish().unwrap();
        assert_eq!(root.len(), 32);

        let mut dec = ChunkDecoder::new(
            Cipher::ChaCha20Poly1305,
            key,
            base_nonce,
            aad,
            out.as_slice(),
        );
        let mut recovered = Vec::new();
        while let Some(chunk) = dec.next_chunk().unwrap() {
            recovered.extend_from_slice(&chunk);
        }
        assert_eq!(recovered, data);
    }

    #[test]
    fn empty_payload() {
        roundtrip(b"", 256 * 1024);
    }

    #[test]
    fn small_payload() {
        roundtrip(b"hello, ZEncrypt", 256 * 1024);
    }

    #[test]
    fn exact_chunk_boundary() {
        let data = vec![0xABu8; 1024];
        roundtrip(&data, 512);
    }

    #[test]
    fn multi_chunk() {
        let data: Vec<u8> = (0..10_000).map(|i| i as u8).collect();
        roundtrip(&data, 256);
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let key = Key([0x77u8; 32]);
        let base_nonce = [0x33u8; 12];
        let aad = b"header".to_vec();

        let mut out = Vec::new();
        let mut enc = ChunkEncoder::new(
            Cipher::ChaCha20Poly1305,
            key.clone(),
            base_nonce,
            aad.clone(),
            &mut out,
            1024,
        );
        enc.write_all(b"sensitive data").unwrap();
        enc.finish().unwrap();


        out[5] ^= 0xFF;

        let mut dec = ChunkDecoder::new(Cipher::ChaCha20Poly1305, key, base_nonce, aad, out.as_slice());
        assert!(dec.next_chunk().is_err());
    }

    #[test]
    fn blake3_root_tamper_fails() {
        let key = Key([0x77u8; 32]);
        let base_nonce = [0x33u8; 12];
        let aad = b"header".to_vec();

        let mut out = Vec::new();
        let mut enc = ChunkEncoder::new(
            Cipher::ChaCha20Poly1305,
            key.clone(),
            base_nonce,
            aad.clone(),
            &mut out,
            1024,
        );
        enc.write_all(b"data").unwrap();
        enc.finish().unwrap();


        let len = out.len();
        out[len - 1] ^= 0xFF;

        let mut dec = ChunkDecoder::new(Cipher::ChaCha20Poly1305, key, base_nonce, aad, out.as_slice());
        let result = dec.next_chunk();
        assert!(result.is_err());
    }
}
