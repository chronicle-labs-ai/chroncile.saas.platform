//! Topic Tree
//!
//! Hierarchical topic paths for event categorization and tree-based visualization.

use std::collections::{HashMap, HashSet};

use egui::Color32;

use crate::event::TimelineEventData;

/// A hierarchical topic path like "intercom/ping" or "stripe/charge/succeeded"
/// Represents the path from source → event type components
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct TopicPath {
    /// Path segments (e.g., ["intercom", "ping"])
    pub segments: Vec<String>,
}

impl TopicPath {
    /// Create from source and event_type
    /// Example: ("intercom", "intercom.ping") → ["intercom", "ping"]
    pub fn from_event(source: &str, event_type: &str) -> Self {
        // Strip source prefix from event_type if present
        let type_part = event_type
            .strip_prefix(&format!("{}.", source))
            .or_else(|| event_type.strip_prefix(&format!("{}_", source)))
            .unwrap_or(event_type);

        // Build path: source / type_segments
        let mut segments = vec![source.to_string()];
        segments.extend(type_part.split('.').map(String::from));

        Self { segments }
    }

    /// Get the root segment (source)
    pub fn root(&self) -> Option<&str> {
        self.segments.first().map(|s| s.as_str())
    }

    /// Get the display string (with slashes)
    pub fn display(&self) -> String {
        self.segments.join("/")
    }

    /// Get the last segment (leaf name)
    pub fn leaf(&self) -> Option<&str> {
        self.segments.last().map(|s| s.as_str())
    }

    /// Get depth (number of segments)
    pub fn depth(&self) -> usize {
        self.segments.len()
    }

    /// Check if this path is a parent of another
    pub fn is_parent_of(&self, other: &TopicPath) -> bool {
        if self.segments.len() >= other.segments.len() {
            return false;
        }
        self.segments
            .iter()
            .zip(other.segments.iter())
            .all(|(a, b)| a == b)
    }

    /// Get parent path
    pub fn parent(&self) -> Option<TopicPath> {
        if self.segments.len() <= 1 {
            return None;
        }
        Some(TopicPath {
            segments: self.segments[..self.segments.len() - 1].to_vec(),
        })
    }
}

impl std::fmt::Display for TopicPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display())
    }
}

/// A node in the topic tree (for collapsible hierarchy display)
#[derive(Clone, Debug)]
pub struct TopicTreeNode {
    /// Path to this node
    pub path: TopicPath,
    /// Display name (last segment)
    pub name: String,
    /// Whether this node is expanded in the UI
    pub expanded: bool,
    /// Children nodes
    pub children: Vec<TopicTreeNode>,
    /// Events at this exact path (leaf nodes only)
    pub event_count: usize,
    /// Color for this topic
    pub color: Color32,
}

impl TopicTreeNode {
    /// Create a new topic tree node
    pub fn new(path: TopicPath, color: Color32) -> Self {
        let name = path.leaf().unwrap_or("").to_string();
        Self {
            path,
            name,
            expanded: true, // Default to expanded
            color,
            children: Vec::new(),
            event_count: 0,
        }
    }

    /// Check if this is a leaf node (no children)
    pub fn is_leaf(&self) -> bool {
        self.children.is_empty()
    }

    /// Get total event count (including children)
    pub fn total_event_count(&self) -> usize {
        self.event_count
            + self
                .children
                .iter()
                .map(|c| c.total_event_count())
                .sum::<usize>()
    }
}

/// Builds a topic tree from events
#[derive(Clone, Debug)]
pub struct TopicTree {
    /// Root nodes (sources)
    pub roots: Vec<TopicTreeNode>,
    /// Collapsed paths (for persistence)
    pub collapsed: HashSet<String>,
}

impl TopicTree {
    /// Create a new empty topic tree
    pub fn new() -> Self {
        Self {
            roots: Vec::new(),
            collapsed: HashSet::new(),
        }
    }

    /// Build tree from events using the TimelineEventData trait
    pub fn from_events<T: TimelineEventData>(events: &[T]) -> Self {
        let mut tree = Self::new();

        // Collect unique paths with counts (only count at leaf paths)
        let mut leaf_path_counts: HashMap<String, usize> = HashMap::new();
        for event in events {
            let path = TopicPath::from_event(event.source(), event.event_type());
            *leaf_path_counts.entry(path.display()).or_default() += 1;
        }

        // Build tree structure - use nested HashMap for proper hierarchy
        let mut root_map: HashMap<String, TopicTreeNode> = HashMap::new();

        for event in events {
            let path = TopicPath::from_event(event.source(), event.event_type());
            if path.segments.is_empty() {
                continue;
            }

            // Navigate/create the tree path
            let source = &path.segments[0];

            // Get color from event or use default
            let color = event.color().unwrap_or_else(|| source_color(source));

            // Get or create root node
            let root_node = root_map.entry(source.clone()).or_insert_with(|| {
                TopicTreeNode::new(
                    TopicPath {
                        segments: vec![source.clone()],
                    },
                    color,
                )
            });

            // Insert remaining path segments as nested children
            if path.segments.len() > 1 {
                Self::insert_path(root_node, &path, 1, &leaf_path_counts, color);
            }
        }

        // Sort roots and all nested children recursively
        let mut roots: Vec<TopicTreeNode> = root_map.into_values().collect();
        roots.sort_by(|a, b| a.name.cmp(&b.name));
        for root in &mut roots {
            Self::sort_children_recursive(root);
        }

        tree.roots = roots;
        tree
    }

    /// Recursively insert a path into the tree
    fn insert_path(
        node: &mut TopicTreeNode,
        full_path: &TopicPath,
        segment_idx: usize,
        leaf_counts: &HashMap<String, usize>,
        color: Color32,
    ) {
        if segment_idx >= full_path.segments.len() {
            return;
        }

        let partial_path = TopicPath {
            segments: full_path.segments[..=segment_idx].to_vec(),
        };
        let partial_path_str = partial_path.display();

        // Find or create child node
        let child_idx = node
            .children
            .iter()
            .position(|c| c.path.display() == partial_path_str);

        let child = if let Some(idx) = child_idx {
            &mut node.children[idx]
        } else {
            let mut new_child =
                TopicTreeNode::new(partial_path.clone(), event_path_color(&partial_path, color));
            // Only set event_count if this is the leaf path
            if segment_idx == full_path.segments.len() - 1 {
                new_child.event_count = *leaf_counts.get(&full_path.display()).unwrap_or(&0);
            }
            node.children.push(new_child);
            node.children.last_mut().unwrap()
        };

        // Recurse for remaining segments
        if segment_idx + 1 < full_path.segments.len() {
            Self::insert_path(child, full_path, segment_idx + 1, leaf_counts, color);
        }
    }

    /// Recursively sort children alphabetically
    fn sort_children_recursive(node: &mut TopicTreeNode) {
        node.children.sort_by(|a, b| a.name.cmp(&b.name));
        for child in &mut node.children {
            Self::sort_children_recursive(child);
        }
    }

    /// Toggle collapse state of a path
    pub fn toggle_collapsed(&mut self, path: &str) {
        if self.collapsed.contains(path) {
            self.collapsed.remove(path);
        } else {
            self.collapsed.insert(path.to_string());
        }

        // Update tree nodes
        for root in &mut self.roots {
            Self::update_expanded(root, &self.collapsed);
        }
    }

    fn update_expanded(node: &mut TopicTreeNode, collapsed: &HashSet<String>) {
        node.expanded = !collapsed.contains(&node.path.display());
        for child in &mut node.children {
            Self::update_expanded(child, collapsed);
        }
    }

    /// Get visible nodes (respecting collapsed state)
    pub fn visible_nodes(&self) -> Vec<TopicTreeNode> {
        let mut result = Vec::new();
        for root in &self.roots {
            Self::collect_visible(root, &mut result);
        }
        result
    }

    fn collect_visible(node: &TopicTreeNode, result: &mut Vec<TopicTreeNode>) {
        result.push(node.clone());
        if node.expanded {
            for child in &node.children {
                Self::collect_visible(child, result);
            }
        }
    }

    /// Iterate over all visible paths (respecting collapsed state)
    pub fn visible_paths(&self) -> Vec<&TopicTreeNode> {
        let mut result = Vec::new();
        for root in &self.roots {
            Self::collect_visible_refs(root, &mut result);
        }
        result
    }

    fn collect_visible_refs<'a>(node: &'a TopicTreeNode, result: &mut Vec<&'a TopicTreeNode>) {
        result.push(node);
        if node.expanded {
            for child in &node.children {
                Self::collect_visible_refs(child, result);
            }
        }
    }
}

impl Default for TopicTree {
    fn default() -> Self {
        Self::new()
    }
}

/// Get color for a source
pub fn source_color(source: &str) -> Color32 {
    match source.to_lowercase().as_str() {
        "intercom" => Color32::from_rgb(64, 180, 166), // Teal
        "stripe" | "mock-stripe" => Color32::from_rgb(99, 91, 255), // Purple/Blue
        "zendesk" => Color32::from_rgb(3, 54, 61),     // Dark teal
        "slack" => Color32::from_rgb(74, 21, 75),      // Purple
        "hubspot" => Color32::from_rgb(255, 122, 89),  // Orange
        "github" => Color32::from_rgb(110, 84, 148),   // Purple
        "salesforce" => Color32::from_rgb(0, 161, 224), // Blue
        _ => {
            // Generate consistent color from name
            let hash = source
                .bytes()
                .fold(0u32, |acc, b| acc.wrapping_add(b as u32));
            let hue = (hash % 360) as f32;
            hsl_to_rgb(hue, 0.6, 0.5)
        }
    }
}

/// Get color for a topic path (uses base color with variations)
pub fn event_path_color(path: &TopicPath, base_color: Color32) -> Color32 {
    // Slightly vary the color based on path depth/content
    let hash = path
        .display()
        .bytes()
        .fold(0u8, |acc, b| acc.wrapping_add(b));
    let variation = (hash as f32 / 255.0) * 0.2 - 0.1; // -10% to +10%
    Color32::from_rgb(
        ((base_color.r() as f32 * (1.0 + variation)).clamp(0.0, 255.0)) as u8,
        ((base_color.g() as f32 * (1.0 + variation)).clamp(0.0, 255.0)) as u8,
        ((base_color.b() as f32 * (1.0 + variation)).clamp(0.0, 255.0)) as u8,
    )
}

/// Convert HSL to RGB
fn hsl_to_rgb(h: f32, s: f32, l: f32) -> Color32 {
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = l - c / 2.0;

    let (r, g, b) = match (h / 60.0) as u32 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };

    Color32::from_rgb(
        ((r + m) * 255.0) as u8,
        ((g + m) * 255.0) as u8,
        ((b + m) * 255.0) as u8,
    )
}
