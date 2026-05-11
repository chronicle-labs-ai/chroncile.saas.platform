use rmcp::{
    model::{CallToolResult, ErrorCode},
    ErrorData as McpError,
};
use serde_json::json;

const INVALID_REQUEST_CODE: i32 = -32_600;
const INVALID_PARAMS_CODE: i32 = -32_602;
const INTERNAL_ERROR_CODE: i32 = -32_603;
const NOT_FOUND_CODE: i32 = -32_004;
const UNAUTHORIZED_CODE: i32 = -32_001;

#[derive(Debug, Clone, Copy)]
pub enum ChronicleMcpErrorKind {
    Unauthorized,
    NotFound,
    InvalidInput,
    Internal,
    Unsupported,
}

#[derive(Debug, Clone)]
pub struct ChronicleMcpError {
    kind: ChronicleMcpErrorKind,
    message: String,
}

impl ChronicleMcpError {
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            kind: ChronicleMcpErrorKind::Unauthorized,
            message: message.into(),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            kind: ChronicleMcpErrorKind::NotFound,
            message: message.into(),
        }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self {
            kind: ChronicleMcpErrorKind::InvalidInput,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            kind: ChronicleMcpErrorKind::Internal,
            message: message.into(),
        }
    }

    pub fn unsupported(message: impl Into<String>) -> Self {
        Self {
            kind: ChronicleMcpErrorKind::Unsupported,
            message: message.into(),
        }
    }

    pub fn to_mcp_error(&self) -> McpError {
        McpError {
            code: ErrorCode(self.code()),
            message: self.message.clone().into(),
            data: Some(json!({
                "kind": self.kind_name(),
            })),
        }
    }

    pub fn to_tool_result(&self) -> CallToolResult {
        CallToolResult::structured_error(json!({
            "error": self.message,
            "kind": self.kind_name(),
        }))
    }

    fn code(&self) -> i32 {
        match self.kind {
            ChronicleMcpErrorKind::Unauthorized => UNAUTHORIZED_CODE,
            ChronicleMcpErrorKind::NotFound => NOT_FOUND_CODE,
            ChronicleMcpErrorKind::InvalidInput => INVALID_PARAMS_CODE,
            ChronicleMcpErrorKind::Internal => INTERNAL_ERROR_CODE,
            ChronicleMcpErrorKind::Unsupported => INVALID_REQUEST_CODE,
        }
    }

    fn kind_name(&self) -> &'static str {
        match self.kind {
            ChronicleMcpErrorKind::Unauthorized => "unauthorized",
            ChronicleMcpErrorKind::NotFound => "not_found",
            ChronicleMcpErrorKind::InvalidInput => "invalid_input",
            ChronicleMcpErrorKind::Internal => "internal",
            ChronicleMcpErrorKind::Unsupported => "unsupported",
        }
    }
}
