use argon2::{Algorithm, Argon2, Params, Version};
use blake3::Hasher as Blake3Hasher;
use rand::RngCore;
use zeroize::Zeroizing;

use super::Key;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KdfPreset {
    Interactive,
    Moderate,
    Paranoid,
}


#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KdfParams {
    pub salt: [u8; 32],

    pub m_kib: u32,

    pub t_iters: u32,

    pub p_lanes: u32,
}

impl KdfParams {
    pub fn from_preset(preset: KdfPreset) -> Self {
        let (m_kib, t_iters, p_lanes) = match preset {
            KdfPreset::Interactive => (65_536, 2, 1),
            KdfPreset::Moderate => (262_144, 3, 2),
            KdfPreset::Paranoid => (1_048_576, 4, 4),
        };
        let mut salt = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut salt);
        Self { salt, m_kib, t_iters, p_lanes }
    }
}


fn check_available_ram(m_kib: u32) -> Result<(), String> {
    use sysinfo::{MemoryRefreshKind, RefreshKind, System};
    let needed_kib = u64::from(m_kib);
    let sys = System::new_with_specifics(
        RefreshKind::new().with_memory(MemoryRefreshKind::new().with_ram()),
    );
    let available_kib = sys.available_memory() / 1024;
    if available_kib < needed_kib + 131_072 {
        return Err(format!(
            "Not enough free memory for this key strength: needs {} MiB, only {} MiB available. Pick a lower 'Key strength' in Settings (Quick or Balanced) or free some memory and retry.",
            needed_kib / 1024,
            available_kib / 1024
        ));
    }
    Ok(())
}

pub fn derive_key(
    password: Option<&[u8]>,
    keyfile_blake3: Option<&[u8; 32]>,
    params: &KdfParams,
) -> Result<Key, String> {
    let ikm: Zeroizing<Vec<u8>> = match (password, keyfile_blake3) {
        (Some(pw), Some(kf)) => {
            let mixed = Blake3Hasher::new_keyed(kf).update(pw).finalize();
            Zeroizing::new(mixed.as_bytes().to_vec())
        }
        (Some(pw), None) => Zeroizing::new(pw.to_vec()),
        (None, Some(kf)) => Zeroizing::new(kf.to_vec()),
        (None, None) => return Err("at least one of password or keyfile must be provided".into()),
    };

    check_available_ram(params.m_kib)?;

    let argon2_params = Params::new(params.m_kib, params.t_iters, params.p_lanes, Some(32))
        .map_err(|e| format!("invalid Argon2id params: {e}"))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon2_params);

    let mut key_bytes = Zeroizing::new([0u8; 32]);
    argon2
        .hash_password_into(&ikm, &params.salt, key_bytes.as_mut())
        .map_err(|e| format!("Argon2id derivation failed: {e}"))?;

    Ok(Key(*key_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_derivation() {
        let params = KdfParams {
            salt: [0x42u8; 32],
            m_kib: 8,
            t_iters: 1,
            p_lanes: 1,
        };
        let k1 = derive_key(Some(b"hunter2"), None, &params).unwrap();
        let k2 = derive_key(Some(b"hunter2"), None, &params).unwrap();
        assert_eq!(k1.0, k2.0);
    }

    #[test]
    fn different_password_different_key() {
        let params = KdfParams {
            salt: [0x01u8; 32],
            m_kib: 8,
            t_iters: 1,
            p_lanes: 1,
        };
        let k1 = derive_key(Some(b"password_a"), None, &params).unwrap();
        let k2 = derive_key(Some(b"password_b"), None, &params).unwrap();
        assert_ne!(k1.0, k2.0);
    }

    #[test]
    fn password_and_keyfile_mix() {
        let params = KdfParams {
            salt: [0x02u8; 32],
            m_kib: 8,
            t_iters: 1,
            p_lanes: 1,
        };
        let kf = [0xABu8; 32];
        let k_both = derive_key(Some(b"pw"), Some(&kf), &params).unwrap();
        let k_pw_only = derive_key(Some(b"pw"), None, &params).unwrap();
        let k_kf_only = derive_key(None, Some(&kf), &params).unwrap();
        assert_ne!(k_both.0, k_pw_only.0);
        assert_ne!(k_both.0, k_kf_only.0);
        assert_ne!(k_pw_only.0, k_kf_only.0);
    }

    #[test]
    fn no_credentials_is_error() {
        let params = KdfParams {
            salt: [0u8; 32],
            m_kib: 8,
            t_iters: 1,
            p_lanes: 1,
        };
        assert!(derive_key(None, None, &params).is_err());
    }
}
