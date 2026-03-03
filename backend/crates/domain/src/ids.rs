//! Thread-Local ULID Generation
//!
//! Provides high-performance, thread-safe ULID generation using thread-local storage
//! to avoid contention under high concurrency.

use std::cell::RefCell;
use ulid::{Generator, Ulid};

thread_local! {
    /// Thread-local ULID generator for monotonic IDs within a thread
    static ULID_GEN: RefCell<Generator> = const { RefCell::new(Generator::new()) };
}

/// Generate a new event ID using thread-local ULID generator
///
/// This is more efficient than creating a new generator for each ID
/// and avoids contention when multiple threads generate IDs concurrently.
///
/// # Returns
/// A monotonically increasing ULID within the same millisecond for each thread.
///
/// # Example
/// ```
/// use chronicle_domain::new_event_id;
///
/// let id1 = new_event_id();
/// let id2 = new_event_id();
/// assert!(id1 < id2); // Monotonic within same thread
/// ```
pub fn new_event_id() -> Ulid {
    ULID_GEN.with(|gen| {
        gen.borrow_mut().generate().unwrap_or_else(|_| Ulid::new()) // Fallback if monotonic overflow (very rare)
    })
}

/// Generate a new connection ID
pub fn new_connection_id() -> String {
    format!("conn_{}", new_event_id())
}

/// Generate a new session ID for replay sessions
pub fn new_session_id() -> String {
    format!("sess_{}", new_event_id())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn test_monotonic_ids() {
        let id1 = new_event_id();
        let id2 = new_event_id();
        let id3 = new_event_id();

        assert!(id1 < id2);
        assert!(id2 < id3);
    }

    #[test]
    fn test_unique_ids() {
        let mut ids = HashSet::new();
        for _ in 0..10000 {
            let id = new_event_id();
            assert!(ids.insert(id), "Generated duplicate ID");
        }
    }

    #[test]
    fn test_connection_id_format() {
        let id = new_connection_id();
        assert!(id.starts_with("conn_"));
    }

    #[test]
    fn test_session_id_format() {
        let id = new_session_id();
        assert!(id.starts_with("sess_"));
    }
}
