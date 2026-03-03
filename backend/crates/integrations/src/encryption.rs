use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, AeadCore, Nonce,
};
use thiserror::Error;

const NONCE_SIZE: usize = 12;

#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("encryption failed: {0}")]
    EncryptFailed(String),
    #[error("decryption failed: {0}")]
    DecryptFailed(String),
    #[error("invalid key: {0}")]
    InvalidKey(String),
    #[error("invalid ciphertext format")]
    InvalidFormat,
}

pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    pub fn from_hex_key(hex_key: &str) -> Result<Self, EncryptionError> {
        let key_bytes = hex::decode(hex_key)
            .map_err(|e| EncryptionError::InvalidKey(format!("invalid hex: {e}")))?;

        if key_bytes.len() != 32 {
            return Err(EncryptionError::InvalidKey(format!(
                "expected 32 bytes, got {}",
                key_bytes.len()
            )));
        }

        let cipher = Aes256Gcm::new_from_slice(&key_bytes)
            .map_err(|e| EncryptionError::InvalidKey(e.to_string()))?;

        Ok(Self { cipher })
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String, EncryptionError> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = self
            .cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| EncryptionError::EncryptFailed(e.to_string()))?;

        let mut combined = nonce.to_vec();
        combined.extend_from_slice(&ciphertext);
        Ok(hex::encode(combined))
    }

    pub fn decrypt(&self, encrypted_hex: &str) -> Result<String, EncryptionError> {
        let combined = hex::decode(encrypted_hex)
            .map_err(|_| EncryptionError::InvalidFormat)?;

        if combined.len() < NONCE_SIZE {
            return Err(EncryptionError::InvalidFormat);
        }

        let (nonce_bytes, ciphertext) = combined.split_at(NONCE_SIZE);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| EncryptionError::DecryptFailed(e.to_string()))?;

        String::from_utf8(plaintext)
            .map_err(|e| EncryptionError::DecryptFailed(format!("invalid utf-8: {e}")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_KEY_HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let service = EncryptionService::from_hex_key(TEST_KEY_HEX).unwrap();

        let plaintext = "sk-live-abc123-very-secret-token";
        let encrypted = service.encrypt(plaintext).unwrap();

        assert_ne!(encrypted, plaintext);

        let decrypted = service.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_different_encryptions_produce_different_ciphertexts() {
        let service = EncryptionService::from_hex_key(TEST_KEY_HEX).unwrap();
        let plaintext = "same-plaintext";

        let enc1 = service.encrypt(plaintext).unwrap();
        let enc2 = service.encrypt(plaintext).unwrap();

        assert_ne!(enc1, enc2, "AES-GCM with random nonces should produce different ciphertexts");

        assert_eq!(service.decrypt(&enc1).unwrap(), plaintext);
        assert_eq!(service.decrypt(&enc2).unwrap(), plaintext);
    }

    #[test]
    fn test_invalid_key_length() {
        let result = EncryptionService::from_hex_key("0123456789abcdef");
        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let service = EncryptionService::from_hex_key(TEST_KEY_HEX).unwrap();

        let encrypted = service.encrypt("secret").unwrap();
        let mut bytes = hex::decode(&encrypted).unwrap();
        if let Some(byte) = bytes.last_mut() {
            *byte ^= 0xFF;
        }
        let tampered = hex::encode(bytes);

        assert!(service.decrypt(&tampered).is_err());
    }
}
