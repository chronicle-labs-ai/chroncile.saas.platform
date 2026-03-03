use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone, Debug)]
pub struct EscalationEntry {
    pub id: String,
    pub tenant_id: String,
    pub trace_id: String,
    pub to_user_id: String,
    pub channel: String,
    pub status: String,
    pub created_at: String,
    pub email_message_id: Option<String>,
    pub email_to: Option<String>,
}

pub type EscalationLog = Arc<RwLock<Vec<EscalationEntry>>>;

pub fn new_escalation_log() -> EscalationLog {
    Arc::new(RwLock::new(Vec::new()))
}
