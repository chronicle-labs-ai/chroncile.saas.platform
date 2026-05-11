//! Verifier — uploads tests/, runs `bash /tests/test.sh`, parses the
//! reward file the test script wrote.
//!
//! Mirrors Harbor's verifier contract verbatim: the test script writes
//! either `/logs/verifier/reward.txt` (single number) or
//! `/logs/verifier/reward.json` (multi-key map). We try `.txt` first,
//! fall back to `.json`. Multiple keys are persisted via
//! `BacktestTrialRepository::record_rewards`.

use crate::error::{OrchestratorError, OrchestratorResult};
use crate::plan::TrialPlan;
use chronicle_sandbox::{ExecRequest, Sandbox};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

// Remote paths sit under `/tmp/chronicle/` so non-root sandbox users
// can write without elevated permissions. Phase 5+ may make these
// driver-configurable; for now the convention is hard-coded.
pub const TESTS_REMOTE_DIR: &str = "/tmp/chronicle/tests";
pub const VERIFIER_REMOTE_DIR: &str = "/tmp/chronicle/logs/verifier";
pub const REWARD_TXT_REMOTE: &str = "/tmp/chronicle/logs/verifier/reward.txt";
pub const REWARD_JSON_REMOTE: &str = "/tmp/chronicle/logs/verifier/reward.json";

pub struct VerifierOutcome {
    pub rewards: HashMap<String, f64>,
    /// The raw bytes of the reward file we read, kept around so the
    /// trial can write it as a `reward-json` / `reward-txt` artifact.
    pub raw_reward_bytes: Vec<u8>,
    pub raw_reward_kind: RewardFileKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RewardFileKind {
    Txt,
    Json,
}

pub struct Verifier;

impl Verifier {
    /// Run the trial's test script in the sandbox and parse the reward
    /// file. Returns the parsed rewards plus the raw bytes (for
    /// artifact persistence).
    ///
    /// The caller is responsible for the verifier-phase timeout — wrap
    /// this method in `tokio::time::timeout`.
    pub async fn verify(
        sandbox: &dyn Sandbox,
        trial: &TrialPlan,
    ) -> OrchestratorResult<VerifierOutcome> {
        // 1. Make sure the verifier log dir exists. The orchestrator
        //    creates it once at sandbox boot, but recreating is cheap
        //    and protects against pre-existing image state. Path lives
        //    under `/tmp/chronicle/` so non-root sandbox users (e.g.
        //    Daytona's `daytona` user) can write here.
        sandbox
            .exec(
                ExecRequest::new(format!(
                    "mkdir -p {VERIFIER_REMOTE_DIR} && chmod 777 {VERIFIER_REMOTE_DIR}"
                ))
                .with_timeout(Duration::from_secs(10)),
            )
            .await?;

        // 2. Upload the local tests dir.
        sandbox
            .upload_dir(&trial.tests_dir, TESTS_REMOTE_DIR)
            .await
            .map_err(|e| OrchestratorError::VerifierFailed(format!(
                "uploading tests dir failed: {e}"
            )))?;

        // 3. Build the test command. Same script-name conventions as
        //    Harbor: prefer `test.sh`, fall back to `test.bash`.
        let test_script = format!("{TESTS_REMOTE_DIR}/test.sh");
        let mut req = ExecRequest::new(format!("bash {test_script}"));
        for (k, v) in &trial.verifier_env {
            req = req.with_env(k.clone(), v.clone());
        }
        let result = sandbox.exec(req).await?;

        if result.return_code != 0 {
            // Non-zero from the test script doesn't always mean
            // "verifier crashed" — if it still wrote a reward file, we
            // honour it (the test author may have decided to exit 1
            // after writing reward 0). But we surface the exit code
            // in stderr for visibility.
            tracing::warn!(
                trial_id = %trial.trial_id,
                exit_code = result.return_code,
                "verifier test script exited non-zero"
            );
        }

        // 4. Try reward.txt → reward.json fallback. We attempt the
        //    download against both paths; the trial body cleans up
        //    on the host side via tempdirs.
        let tmp = std::env::temp_dir().join(format!(
            "chronicle_verifier_{}",
            ulid::Ulid::new()
        ));
        std::fs::create_dir_all(&tmp).map_err(|e| {
            OrchestratorError::Internal(format!("verifier tempdir: {e}"))
        })?;

        let outcome = Self::try_parse_reward_file(sandbox, &tmp, RewardFileKind::Txt).await;
        let outcome = match outcome {
            Ok(o) => Ok(o),
            Err(_) => {
                Self::try_parse_reward_file(sandbox, &tmp, RewardFileKind::Json).await
            }
        };

        // Best-effort cleanup of the host-side scratch dir.
        let _ = std::fs::remove_dir_all(&tmp);

        outcome.map_err(|e| {
            OrchestratorError::VerifierFailed(format!(
                "no parseable reward file at {REWARD_TXT_REMOTE} or \
                 {REWARD_JSON_REMOTE} (last error: {e})"
            ))
        })
    }

    async fn try_parse_reward_file(
        sandbox: &dyn Sandbox,
        host_tmp: &PathBuf,
        kind: RewardFileKind,
    ) -> OrchestratorResult<VerifierOutcome> {
        let (remote, file_name) = match kind {
            RewardFileKind::Txt => (REWARD_TXT_REMOTE, "reward.txt"),
            RewardFileKind::Json => (REWARD_JSON_REMOTE, "reward.json"),
        };
        let local = host_tmp.join(file_name);
        sandbox
            .download_file(remote, &local)
            .await
            .map_err(|e| OrchestratorError::VerifierFailed(format!(
                "could not download {remote}: {e}"
            )))?;

        let raw = std::fs::read(&local).map_err(|e| {
            OrchestratorError::VerifierFailed(format!("reading {} on host: {e}", local.display()))
        })?;

        let rewards = match kind {
            RewardFileKind::Txt => parse_reward_txt(&raw)?,
            RewardFileKind::Json => parse_reward_json(&raw)?,
        };

        Ok(VerifierOutcome {
            rewards,
            raw_reward_bytes: raw,
            raw_reward_kind: kind,
        })
    }
}

/// Parse a single-number `reward.txt`. Whitespace/EOL tolerated.
fn parse_reward_txt(bytes: &[u8]) -> OrchestratorResult<HashMap<String, f64>> {
    let s = std::str::from_utf8(bytes).map_err(|e| {
        OrchestratorError::VerifierFailed(format!("reward.txt is not utf-8: {e}"))
    })?;
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(OrchestratorError::VerifierFailed(
            "reward.txt is empty".to_string(),
        ));
    }
    let value: f64 = trimmed.parse().map_err(|e| {
        OrchestratorError::VerifierFailed(format!(
            "reward.txt content '{trimmed}' is not a number: {e}"
        ))
    })?;
    let mut map = HashMap::new();
    map.insert("reward".to_string(), value);
    Ok(map)
}

/// Parse a multi-key `reward.json`. Top-level must be an object whose
/// values are numbers; non-numeric values are dropped with a warning.
fn parse_reward_json(bytes: &[u8]) -> OrchestratorResult<HashMap<String, f64>> {
    let value: serde_json::Value = serde_json::from_slice(bytes).map_err(|e| {
        OrchestratorError::VerifierFailed(format!("reward.json is not valid JSON: {e}"))
    })?;
    let object = value.as_object().ok_or_else(|| {
        OrchestratorError::VerifierFailed(
            "reward.json must be a JSON object".to_string(),
        )
    })?;
    let mut out = HashMap::new();
    for (key, val) in object {
        match val {
            serde_json::Value::Number(n) => {
                if let Some(f) = n.as_f64() {
                    out.insert(key.clone(), f);
                }
            }
            serde_json::Value::Bool(b) => {
                // Accept bool as 0/1 — some test scripts emit booleans.
                out.insert(key.clone(), if *b { 1.0 } else { 0.0 });
            }
            _ => {
                tracing::warn!(
                    "reward.json key '{key}' has non-numeric value, ignoring"
                );
            }
        }
    }
    if out.is_empty() {
        return Err(OrchestratorError::VerifierFailed(
            "reward.json had no numeric keys".to_string(),
        ));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reward_txt_parses_int() {
        let m = parse_reward_txt(b"1\n").unwrap();
        assert_eq!(m.get("reward"), Some(&1.0));
    }

    #[test]
    fn reward_txt_parses_float() {
        let m = parse_reward_txt(b"  0.875  ").unwrap();
        assert_eq!(m.get("reward"), Some(&0.875));
    }

    #[test]
    fn reward_txt_rejects_garbage() {
        assert!(parse_reward_txt(b"not a number").is_err());
        assert!(parse_reward_txt(b"").is_err());
    }

    #[test]
    fn reward_json_parses_multi_key() {
        let raw = br#"{"accuracy": 0.91, "latency_ms": 1240, "passed": true}"#;
        let m = parse_reward_json(raw).unwrap();
        assert_eq!(m.get("accuracy"), Some(&0.91));
        assert_eq!(m.get("latency_ms"), Some(&1240.0));
        assert_eq!(m.get("passed"), Some(&1.0));
    }

    #[test]
    fn reward_json_drops_non_numeric_but_keeps_some() {
        let raw = br#"{"reward": 1.0, "label": "good"}"#;
        let m = parse_reward_json(raw).unwrap();
        assert_eq!(m.len(), 1);
        assert_eq!(m.get("reward"), Some(&1.0));
    }

    #[test]
    fn reward_json_rejects_non_object() {
        assert!(parse_reward_json(b"42").is_err());
        assert!(parse_reward_json(b"[]").is_err());
    }

    #[test]
    fn reward_json_rejects_empty_object() {
        assert!(parse_reward_json(b"{}").is_err());
    }
}
