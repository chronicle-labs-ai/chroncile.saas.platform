use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

const EXPECTED_SCHEME: &str = "v1";
const SIGNATURE_TOLERANCE_SECS: i64 = 300;

#[derive(Debug, thiserror::Error)]
pub enum StripeWebhookError {
    #[error("missing stripe-signature header")]
    MissingHeader,
    #[error("invalid header format")]
    InvalidFormat,
    #[error("no valid signature found")]
    InvalidSignature,
    #[error("timestamp outside tolerance")]
    TimestampOutOfRange,
}

pub fn verify_webhook_signature(
    payload: &[u8],
    sig_header: &str,
    secret: &str,
) -> Result<(), StripeWebhookError> {
    let parts: Vec<&str> = sig_header.split(',').collect();

    let mut timestamp: Option<&str> = None;
    let mut signatures: Vec<&str> = Vec::new();

    for part in &parts {
        let kv: Vec<&str> = part.splitn(2, '=').collect();
        if kv.len() != 2 {
            continue;
        }
        match kv[0] {
            "t" => timestamp = Some(kv[1]),
            scheme if scheme == EXPECTED_SCHEME => signatures.push(kv[1]),
            _ => {}
        }
    }

    let timestamp = timestamp.ok_or(StripeWebhookError::InvalidFormat)?;

    if signatures.is_empty() {
        return Err(StripeWebhookError::InvalidSignature);
    }

    let ts_num: i64 = timestamp
        .parse()
        .map_err(|_| StripeWebhookError::InvalidFormat)?;

    let now = chrono::Utc::now().timestamp();
    if (now - ts_num).abs() > SIGNATURE_TOLERANCE_SECS {
        return Err(StripeWebhookError::TimestampOutOfRange);
    }

    let signed_payload = format!("{}.{}", timestamp, std::str::from_utf8(payload).unwrap_or(""));

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| StripeWebhookError::InvalidSignature)?;
    mac.update(signed_payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    if signatures.iter().any(|sig| *sig == expected) {
        Ok(())
    } else {
        Err(StripeWebhookError::InvalidSignature)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_sig(payload: &[u8], secret: &str) -> String {
        let timestamp = chrono::Utc::now().timestamp();
        let signed_payload = format!(
            "{}.{}",
            timestamp,
            std::str::from_utf8(payload).unwrap()
        );

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());

        format!("t={},v1={}", timestamp, sig)
    }

    #[test]
    fn test_valid_signature() {
        let payload = b"{\"type\":\"checkout.session.completed\"}";
        let secret = "whsec_test_secret_123";
        let header = make_sig(payload, secret);

        assert!(verify_webhook_signature(payload, &header, secret).is_ok());
    }

    #[test]
    fn test_invalid_signature() {
        let payload = b"{\"type\":\"checkout.session.completed\"}";
        let secret = "whsec_test_secret_123";
        let header = make_sig(payload, secret);

        let result = verify_webhook_signature(payload, &header, "wrong_secret");
        assert!(matches!(result, Err(StripeWebhookError::InvalidSignature)));
    }

    #[test]
    fn test_tampered_payload() {
        let payload = b"{\"type\":\"checkout.session.completed\"}";
        let secret = "whsec_test_secret_123";
        let header = make_sig(payload, secret);

        let tampered = b"{\"type\":\"checkout.session.completed\",\"hacked\":true}";
        let result = verify_webhook_signature(tampered, &header, secret);
        assert!(matches!(result, Err(StripeWebhookError::InvalidSignature)));
    }

    #[test]
    fn test_missing_timestamp() {
        let result = verify_webhook_signature(b"{}", "v1=abc123", "secret");
        assert!(matches!(result, Err(StripeWebhookError::InvalidFormat)));
    }

    #[test]
    fn test_no_signatures() {
        let result = verify_webhook_signature(b"{}", "t=12345", "secret");
        assert!(matches!(result, Err(StripeWebhookError::InvalidSignature)));
    }
}
