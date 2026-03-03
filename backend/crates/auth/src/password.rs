use crate::error::AuthError;

const BCRYPT_COST: u32 = 12;

pub fn hash_password(password: &str) -> Result<String, AuthError> {
    bcrypt::hash(password, BCRYPT_COST)
        .map_err(|e| AuthError::Internal(format!("password hashing failed: {e}")))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AuthError> {
    bcrypt::verify(password, hash)
        .map_err(|e| AuthError::Internal(format!("password verification failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "SecurePassword123!";
        let hash = hash_password(password).unwrap();

        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("WrongPassword", &hash).unwrap());
    }

    #[test]
    fn test_different_passwords_produce_different_hashes() {
        let hash1 = hash_password("password1").unwrap();
        let hash2 = hash_password("password2").unwrap();
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_bcrypt_cross_hash_verification() {
        // Verify Rust bcrypt produces $2b$ hashes that follow bcrypt spec.
        // Node's bcryptjs uses $2a$ prefix. Rust bcrypt can verify both.
        let password = "TestPass123!";
        let hash = hash_password(password).unwrap();

        assert!(
            hash.starts_with("$2b$12$"),
            "Expected $2b$12$ prefix, got: {}",
            &hash[..7]
        );

        // Verify we can validate the hash we produced
        assert!(verify_password(password, &hash).unwrap());

        // $2a$ and $2b$ are functionally identical for verification.
        // Replace the prefix to simulate a Node bcryptjs hash.
        let node_style_hash = hash.replacen("$2b$", "$2a$", 1);
        assert!(verify_password(password, &node_style_hash).unwrap());
        assert!(!verify_password("WrongPassword", &node_style_hash).unwrap());
    }
}
