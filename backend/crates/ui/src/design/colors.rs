//! Anduril Color System
//!
//! Near-black backgrounds (charcoal, gunmetal, deep graphite)
//! Color is a signaling system, not decoration.

use egui::Color32;

// Primary backgrounds - deep, matte, industrial
pub const BG_BASE: Color32 = Color32::from_rgb(12, 12, 14); // Near black
pub const BG_SURFACE: Color32 = Color32::from_rgb(18, 18, 21); // Panels
pub const BG_ELEVATED: Color32 = Color32::from_rgb(24, 24, 28); // Cards
pub const BG_CONTROL: Color32 = Color32::from_rgb(32, 32, 38); // Input fields
pub const BG_HOVER: Color32 = Color32::from_rgb(40, 40, 48); // Hover states
pub const BG_ACTIVE: Color32 = Color32::from_rgb(48, 48, 58); // Active/pressed

// Borders and separators - subtle structural elements
pub const BORDER_SUBTLE: Color32 = Color32::from_rgb(38, 38, 44);
pub const BORDER_DEFAULT: Color32 = Color32::from_rgb(52, 52, 60);
pub const BORDER_STRONG: Color32 = Color32::from_rgb(72, 72, 82);
pub const BORDER_FOCUS: Color32 = Color32::from_rgb(92, 140, 130);

// Text hierarchy - clear, authoritative
pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(232, 232, 236); // Main content
pub const TEXT_SECONDARY: Color32 = Color32::from_rgb(168, 168, 178); // Labels
pub const TEXT_MUTED: Color32 = Color32::from_rgb(108, 108, 118); // Hints
pub const TEXT_DISABLED: Color32 = Color32::from_rgb(68, 68, 78); // Disabled

// Signal colors - functional, consequence-based
pub const SIGNAL_GREEN: Color32 = Color32::from_rgb(52, 168, 83); // Operational, success
pub const SIGNAL_AMBER: Color32 = Color32::from_rgb(251, 188, 4); // Caution, warning
pub const SIGNAL_RED: Color32 = Color32::from_rgb(234, 67, 53); // Critical, error
pub const SIGNAL_BLUE: Color32 = Color32::from_rgb(66, 133, 244); // Information

// Accent colors - desaturated, professional
pub const ACCENT_TEAL: Color32 = Color32::from_rgb(64, 180, 166); // Primary interactive
pub const ACCENT_TEAL_DIM: Color32 = Color32::from_rgb(38, 100, 92); // Subdued teal
pub const ACCENT_SLATE: Color32 = Color32::from_rgb(100, 116, 139); // Secondary
pub const ACCENT_STEEL: Color32 = Color32::from_rgb(120, 140, 170); // Highlight

// Status-specific desaturated colors
pub const STATUS_ONLINE: Color32 = Color32::from_rgb(52, 140, 83); // Active connection
pub const STATUS_OFFLINE: Color32 = Color32::from_rgb(120, 60, 60); // Disconnected
pub const STATUS_PENDING: Color32 = Color32::from_rgb(150, 140, 60); // Waiting

// Event type colors - muted, functional palette
pub const EVENT_CUSTOMER: Color32 = Color32::from_rgb(64, 160, 130); // Teal-green
pub const EVENT_AGENT: Color32 = Color32::from_rgb(80, 130, 180); // Slate blue
pub const EVENT_SYSTEM: Color32 = Color32::from_rgb(120, 120, 130); // Neutral gray
pub const EVENT_AI: Color32 = Color32::from_rgb(140, 120, 170); // Muted purple
pub const EVENT_ESCALATION: Color32 = Color32::from_rgb(180, 90, 90); // Warning red
pub const EVENT_NOTE: Color32 = Color32::from_rgb(170, 150, 80); // Muted amber

// ==========================================================================
// Rerun-inspired Timeline Colors
// ==========================================================================

/// Light gray background for timeline area (matches Rerun's style)
pub const TIMELINE_BG: Color32 = Color32::from_rgb(28, 28, 32);
/// Slightly lighter for alternating rows
pub const TIMELINE_ROW_ALT: Color32 = Color32::from_rgb(32, 32, 36);
/// Hover highlight for timeline rows
pub const TIMELINE_ROW_HOVER: Color32 = Color32::from_rgb(40, 40, 46);
/// Selected row background
pub const TIMELINE_ROW_SELECTED: Color32 = Color32::from_rgb(48, 52, 58);

/// Timeline separator lines (very subtle)
pub const TIMELINE_SEPARATOR: Color32 = Color32::from_rgb(48, 48, 54);
/// Time axis tick color
pub const TIMELINE_TICK: Color32 = Color32::from_rgb(80, 80, 90);
/// Time axis label color
pub const TIMELINE_TICK_LABEL: Color32 = Color32::from_rgb(120, 120, 130);

/// Event dot default color (neutral gray like Rerun)
pub const TIMELINE_DOT: Color32 = Color32::from_rgb(140, 140, 150);
/// Event dot hover color
pub const TIMELINE_DOT_HOVER: Color32 = Color32::from_rgb(180, 180, 190);
/// Event dot selected color
pub const TIMELINE_DOT_SELECTED: Color32 = Color32::from_rgb(255, 255, 255);

/// Playhead line color (bright, high contrast)
pub const PLAYHEAD: Color32 = Color32::from_rgb(66, 165, 245);
/// Playhead line color when in live mode
pub const PLAYHEAD_LIVE: Color32 = Color32::from_rgb(76, 175, 80);

/// Tree expand/collapse icon color
pub const TREE_CHEVRON: Color32 = Color32::from_rgb(100, 100, 110);
/// Tree indent guide color
pub const TREE_INDENT_GUIDE: Color32 = Color32::from_rgb(48, 48, 54);

// ==========================================================================
// Legacy Color Aliases (for backwards compatibility)
// ==========================================================================

/// Backwards-compatible color module that maps to new design system
pub mod compat {
    use egui::Color32;

    // Map old names to new
    pub const BG_DARKEST: Color32 = super::BG_BASE;
    pub const BG_DARK: Color32 = super::BG_SURFACE;
    pub const BG_CARD: Color32 = super::BG_ELEVATED;
    pub const BG_HOVER: Color32 = super::BG_HOVER;
    pub const BG_SELECTED: Color32 = super::BG_ACTIVE;

    pub const ACCENT_CYAN: Color32 = super::ACCENT_TEAL;
    pub const ACCENT_PURPLE: Color32 = Color32::from_rgb(100, 90, 130);
    pub const ACCENT_PINK: Color32 = Color32::from_rgb(160, 90, 120);

    pub const CUSTOMER: Color32 = super::EVENT_CUSTOMER;
    pub const AGENT: Color32 = super::EVENT_AGENT;
    pub const NOTE: Color32 = super::EVENT_NOTE;
    pub const AI: Color32 = super::EVENT_AI;
    pub const ESCALATION: Color32 = super::EVENT_ESCALATION;
    pub const SYSTEM: Color32 = super::EVENT_SYSTEM;

    pub const SUCCESS: Color32 = super::SIGNAL_GREEN;
    pub const WARNING: Color32 = super::SIGNAL_AMBER;
    pub const ERROR: Color32 = super::SIGNAL_RED;
    pub const INFO: Color32 = super::SIGNAL_BLUE;

    pub const TEXT_PRIMARY: Color32 = super::TEXT_PRIMARY;
    pub const TEXT_SECONDARY: Color32 = super::TEXT_SECONDARY;
    pub const TEXT_MUTED: Color32 = super::TEXT_MUTED;
}

