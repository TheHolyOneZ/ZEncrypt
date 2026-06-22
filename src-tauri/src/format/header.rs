use std::io::{Read, Write};
use bitflags::bitflags;

use crate::crypto::{aead::Cipher, kdf::KdfParams, pubkey::PUBKEY_BLOCK_LEN};
use super::{MAGIC, FORMAT_VERSION, MIN_SUPPORTED_VERSION};

bitflags! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct Flags: u8 {
        const HAS_KEYFILE   = 0b0000_0001;
        const IS_COMPRESSED = 0b0000_0010;
        const IS_PUBKEY     = 0b0000_0100;
    }
}


#[derive(Debug, Clone)]
pub struct ZencHeader {
    pub cipher: Cipher,
    pub flags: Flags,
    pub kdf: KdfParams,
    pub base_nonce: [u8; 12],


    pub keyfile_fp: Option<[u8; 4]>,


    pub pubkey_block: Option<Vec<u8>>,
}


pub const HEADER_SIZE_V1: usize = 4 + 1 + 1 + 1 + 32 + 4 + 4 + 4 + 12;
pub const HEADER_SIZE: usize = HEADER_SIZE_V1;

impl ZencHeader {
    pub fn write_to<W: Write>(&self, w: &mut W) -> std::io::Result<()> {
        w.write_all(MAGIC)?;
        w.write_all(&[FORMAT_VERSION])?;
        w.write_all(&[self.cipher.to_byte()])?;
        w.write_all(&[self.flags.bits()])?;
        w.write_all(&self.kdf.salt)?;
        w.write_all(&self.kdf.m_kib.to_le_bytes())?;
        w.write_all(&self.kdf.t_iters.to_le_bytes())?;
        w.write_all(&self.kdf.p_lanes.to_le_bytes())?;
        w.write_all(&self.base_nonce)?;

        if self.flags.contains(Flags::HAS_KEYFILE) {
            let fp = self.keyfile_fp.unwrap_or([0u8; 4]);
            w.write_all(&fp)?;
        }

        if self.flags.contains(Flags::IS_PUBKEY) {
            let block = self.pubkey_block.as_deref()
                .ok_or_else(|| std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "IS_PUBKEY set but pubkey_block missing",
                ))?;
            if block.len() != PUBKEY_BLOCK_LEN {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "pubkey_block has wrong length",
                ));
            }
            w.write_all(block)?;
        }
        Ok(())
    }

    pub fn read_from<R: Read>(r: &mut R) -> std::io::Result<Self> {
        let mut magic = [0u8; 4];
        r.read_exact(&mut magic)?;
        if &magic != MAGIC {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "not a .zsec file (bad magic bytes)",
            ));
        }

        let mut buf1 = [0u8; 1];
        r.read_exact(&mut buf1)?;
        let version = buf1[0];
        if version < MIN_SUPPORTED_VERSION || version > FORMAT_VERSION {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("unsupported .zsec version: {}", version),
            ));
        }

        r.read_exact(&mut buf1)?;
        let cipher = Cipher::from_byte(buf1[0]).ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidData, "unknown cipher id")
        })?;

        r.read_exact(&mut buf1)?;
        let flags = Flags::from_bits_truncate(buf1[0]);

        let mut salt = [0u8; 32];
        r.read_exact(&mut salt)?;

        let mut buf4 = [0u8; 4];
        r.read_exact(&mut buf4)?;
        let m_kib = u32::from_le_bytes(buf4);
        r.read_exact(&mut buf4)?;
        let t_iters = u32::from_le_bytes(buf4);
        r.read_exact(&mut buf4)?;
        let p_lanes = u32::from_le_bytes(buf4);

        let mut base_nonce = [0u8; 12];
        r.read_exact(&mut base_nonce)?;


        let keyfile_fp = if version >= 0x02 && flags.contains(Flags::HAS_KEYFILE) {
            let mut fp = [0u8; 4];
            r.read_exact(&mut fp)?;
            Some(fp)
        } else {
            None
        };


        let pubkey_block = if version >= 0x03 && flags.contains(Flags::IS_PUBKEY) {
            let mut block = vec![0u8; PUBKEY_BLOCK_LEN];
            r.read_exact(&mut block)?;
            Some(block)
        } else {
            None
        };

        if flags.contains(Flags::HAS_KEYFILE) && flags.contains(Flags::IS_PUBKEY) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "header sets both HAS_KEYFILE and IS_PUBKEY",
            ));
        }

        Ok(ZencHeader {
            cipher,
            flags,
            kdf: KdfParams { salt, m_kib, t_iters, p_lanes },
            base_nonce,
            keyfile_fp,
            pubkey_block,
        })
    }


    pub fn to_aad_bytes(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(HEADER_SIZE + 4);
        self.write_to(&mut buf).expect("write to Vec never fails");
        buf
    }
}


#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZencHeaderInfo {
    pub cipher: String,
    pub kdf_preset_label: String,
    pub kdf_m_kib: u32,
    pub kdf_t_iters: u32,
    pub kdf_p_lanes: u32,
    pub has_keyfile: bool,
    pub is_compressed: bool,
    pub is_pubkey: bool,


    pub keyfile_fingerprint: String,

    pub recipient_fingerprint: String,
}

impl From<&ZencHeader> for ZencHeaderInfo {
    fn from(h: &ZencHeader) -> Self {
        let cipher = match h.cipher {
            Cipher::ChaCha20Poly1305 => "ChaCha20-Poly1305".into(),
            Cipher::Aes256Gcm => "AES-256-GCM".into(),
        };
        let kdf_preset_label = if h.flags.contains(Flags::IS_PUBKEY) {
            "Public key".into()
        } else {
            match h.kdf.m_kib {
                m if m <= 65_536 => "Quick".into(),
                m if m <= 262_144 => "Balanced".into(),
                _ => "Maximum".into(),
            }
        };
        let keyfile_fingerprint = h.keyfile_fp
            .map(|fp| fp.iter().map(|b| format!("{:02x}", b)).collect::<String>())
            .unwrap_or_default();
        let recipient_fingerprint = h.pubkey_block
            .as_deref()
            .map(crate::crypto::pubkey::recipient_fingerprint_hex_from_block)
            .unwrap_or_default();
        ZencHeaderInfo {
            cipher,
            kdf_preset_label,
            kdf_m_kib: h.kdf.m_kib,
            kdf_t_iters: h.kdf.t_iters,
            kdf_p_lanes: h.kdf.p_lanes,
            has_keyfile: h.flags.contains(Flags::HAS_KEYFILE),
            is_compressed: h.flags.contains(Flags::IS_COMPRESSED),
            is_pubkey: h.flags.contains(Flags::IS_PUBKEY),
            keyfile_fingerprint,
            recipient_fingerprint,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_header() -> ZencHeader {
        ZencHeader {
            cipher: Cipher::ChaCha20Poly1305,
            flags: Flags::HAS_KEYFILE | Flags::IS_COMPRESSED,
            kdf: KdfParams {
                salt: [0xABu8; 32],
                m_kib: 65_536,
                t_iters: 2,
                p_lanes: 1,
            },
            base_nonce: [0x77u8; 12],
            keyfile_fp: Some([0xDE, 0xAD, 0xBE, 0xEF]),
            pubkey_block: None,
        }
    }

    #[test]
    fn header_roundtrip() {
        let h = sample_header();
        let mut buf = Vec::new();
        h.write_to(&mut buf).unwrap();

        assert_eq!(buf.len(), HEADER_SIZE + 4);

        let h2 = ZencHeader::read_from(&mut buf.as_slice()).unwrap();
        assert_eq!(h2.cipher, h.cipher);
        assert_eq!(h2.flags, h.flags);
        assert_eq!(h2.kdf.salt, h.kdf.salt);
        assert_eq!(h2.kdf.m_kib, h.kdf.m_kib);
        assert_eq!(h2.base_nonce, h.base_nonce);
        assert_eq!(h2.keyfile_fp, h.keyfile_fp);
    }

    #[test]
    fn header_roundtrip_no_keyfile() {
        let mut h = sample_header();
        h.flags = Flags::IS_COMPRESSED;
        h.keyfile_fp = None;
        let mut buf = Vec::new();
        h.write_to(&mut buf).unwrap();
        assert_eq!(buf.len(), HEADER_SIZE);
        let h2 = ZencHeader::read_from(&mut buf.as_slice()).unwrap();
        assert_eq!(h2.keyfile_fp, None);
    }

    #[test]
    fn bad_magic_rejected() {
        let mut buf = vec![0u8; 63];
        buf[0] = b'X';
        assert!(ZencHeader::read_from(&mut buf.as_slice()).is_err());
    }

    #[test]
    fn aad_bytes_stable() {
        let h = sample_header();
        let a1 = h.to_aad_bytes();
        let a2 = h.to_aad_bytes();
        assert_eq!(a1, a2);
        assert_eq!(a1.len(), HEADER_SIZE + 4);
    }

    #[test]
    fn header_roundtrip_pubkey() {
        let block = vec![0x33u8; PUBKEY_BLOCK_LEN];
        let h = ZencHeader {
            cipher: Cipher::Aes256Gcm,
            flags: Flags::IS_PUBKEY | Flags::IS_COMPRESSED,
            kdf: KdfParams { salt: [0u8; 32], m_kib: 0, t_iters: 0, p_lanes: 0 },
            base_nonce: [0x11u8; 12],
            keyfile_fp: None,
            pubkey_block: Some(block.clone()),
        };
        let mut buf = Vec::new();
        h.write_to(&mut buf).unwrap();
        assert_eq!(buf.len(), HEADER_SIZE + PUBKEY_BLOCK_LEN);

        let h2 = ZencHeader::read_from(&mut buf.as_slice()).unwrap();
        assert_eq!(h2.flags, h.flags);
        assert_eq!(h2.pubkey_block.as_deref(), Some(block.as_slice()));
        assert_eq!(h2.keyfile_fp, None);
    }

    #[test]
    fn rejects_keyfile_and_pubkey_both() {
        let h = ZencHeader {
            cipher: Cipher::ChaCha20Poly1305,
            flags: Flags::HAS_KEYFILE | Flags::IS_PUBKEY,
            kdf: KdfParams { salt: [0u8; 32], m_kib: 0, t_iters: 0, p_lanes: 0 },
            base_nonce: [0u8; 12],
            keyfile_fp: Some([0u8; 4]),
            pubkey_block: Some(vec![0u8; PUBKEY_BLOCK_LEN]),
        };
        let mut buf = Vec::new();
        h.write_to(&mut buf).unwrap();
        assert!(ZencHeader::read_from(&mut buf.as_slice()).is_err());
    }
}
