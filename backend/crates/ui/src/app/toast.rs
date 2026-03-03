//! Toast Notifications
//!
//! Simple notification system for user feedback.

/// Toast notification
#[derive(Clone)]
pub struct Toast {
    pub message: String,
    pub kind: ToastKind,
    #[cfg(not(target_arch = "wasm32"))]
    pub created_at: std::time::Instant,
    #[cfg(target_arch = "wasm32")]
    pub created_at: f64, // Performance.now() timestamp
}

#[derive(Clone, Copy, PartialEq)]
pub enum ToastKind {
    Success,
    Info,
    Warning,
    Error,
}

impl Toast {
    pub fn success(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            kind: ToastKind::Success,
            #[cfg(not(target_arch = "wasm32"))]
            created_at: std::time::Instant::now(),
            #[cfg(target_arch = "wasm32")]
            created_at: web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now())
                .unwrap_or(0.0),
        }
    }

    pub fn info(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            kind: ToastKind::Info,
            #[cfg(not(target_arch = "wasm32"))]
            created_at: std::time::Instant::now(),
            #[cfg(target_arch = "wasm32")]
            created_at: web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now())
                .unwrap_or(0.0),
        }
    }

    #[allow(dead_code)]
    pub fn warning(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            kind: ToastKind::Warning,
            #[cfg(not(target_arch = "wasm32"))]
            created_at: std::time::Instant::now(),
            #[cfg(target_arch = "wasm32")]
            created_at: web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now())
                .unwrap_or(0.0),
        }
    }

    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            kind: ToastKind::Error,
            #[cfg(not(target_arch = "wasm32"))]
            created_at: std::time::Instant::now(),
            #[cfg(target_arch = "wasm32")]
            created_at: web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now())
                .unwrap_or(0.0),
        }
    }

    pub fn is_expired(&self) -> bool {
        #[cfg(not(target_arch = "wasm32"))]
        {
            self.created_at.elapsed().as_secs() > 4
        }
        #[cfg(target_arch = "wasm32")]
        {
            let now = web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now())
                .unwrap_or(0.0);
            (now - self.created_at) > 4000.0
        }
    }
}
