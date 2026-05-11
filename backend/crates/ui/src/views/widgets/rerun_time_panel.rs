//! Rerun-style Time Panel Widget
//!
//! Re-implements Rerun's time panel layout and interactions:
//! - Streams tree on the left (entity/path hierarchy)
//! - Time axis and timeline on the right
//! - Data density graphs per row with smoothing
//! - Playhead cursor with pan/zoom and live follow
//! - Shadow separator between tree and timeline

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Duration, Utc};
use egui::epaint::Vertex;
use egui::{pos2, Align2, Color32, Pos2, Rangef, Rect, Sense, Shape, Stroke, Ui, Vec2};

use crate::design::{colors, rounding, spacing, typography};
use crate::types::EventDto;

// Import types from timeline-core
use chronicle_timeline_core::{
    format_duration, DisplayTimezone, PlaybackState, TimeView, TopicPath, TopicTree, TopicTreeNode,
};

// ----------------------------------------------------------------------------
// Config + Response
// ----------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct RerunTimePanelConfig {
    pub row_height: f32,
    pub header_height: f32,
    pub label_width: f32,
    pub indent_size: f32,
    pub density_height: f32,
    pub gap_width: f32,
    pub collapse_gaps: bool,
    pub show_counts: bool,
}

impl Default for RerunTimePanelConfig {
    fn default() -> Self {
        Self {
            row_height: 22.0,
            header_height: 28.0,
            label_width: 220.0,
            indent_size: 14.0,
            density_height: 12.0,
            gap_width: 12.0,
            collapse_gaps: false,
            show_counts: true,
        }
    }
}

#[derive(Default)]
pub struct RerunTimePanelResponse {
    pub clicked_event_id: Option<String>,
    pub playhead_changed: bool,
    pub new_playhead: Option<DateTime<Utc>>,
    pub view_panned: bool,
    pub view_zoomed: bool,
}

// ----------------------------------------------------------------------------
// Density Graph (for row density visualization)
// ----------------------------------------------------------------------------

/// Bucket for density calculation
#[derive(Clone, Copy, Default)]
struct DensityBucket {
    density: f32,
}

/// Density graph data structure for row visualization
struct DensityGraph {
    buckets: Vec<DensityBucket>,
    min_x: f32,
    max_x: f32,
}

impl DensityGraph {
    fn new(x_range: Rangef) -> Self {
        let margin = 2.0;
        let min_x = x_range.min - margin;
        let max_x = x_range.max + margin;
        let n = ((max_x - min_x) * 1.0).ceil() as usize; // 1 bucket per pixel
        Self {
            buckets: vec![DensityBucket::default(); n.max(1)],
            min_x,
            max_x,
        }
    }

    fn x_from_bucket_index(&self, i: usize) -> f32 {
        let t = i as f32 / (self.buckets.len() as f32 - 1.0).max(1.0);
        self.min_x + t * (self.max_x - self.min_x)
    }

    fn add_point(&mut self, x: f32, count: f32) {
        let bucket_idx = {
            let t = (x - self.min_x) / (self.max_x - self.min_x);
            t * (self.buckets.len() as f32 - 1.0)
        };
        let fract = bucket_idx - bucket_idx.floor();
        let i = bucket_idx.floor() as i64;

        if let Ok(idx) = usize::try_from(i) {
            if let Some(bucket) = self.buckets.get_mut(idx) {
                bucket.density += (1.0 - fract) * count;
            }
        }
        if let Ok(idx) = usize::try_from(i + 1) {
            if let Some(bucket) = self.buckets.get_mut(idx) {
                bucket.density += fract * count;
            }
        }
    }

    /// Apply Gaussian-like smoothing
    fn smooth(&mut self) {
        let kernel = [0.1, 0.2, 0.4, 0.2, 0.1];
        let old = self.buckets.clone();
        for i in 0..self.buckets.len() {
            let mut sum = 0.0;
            for (j, &k) in kernel.iter().enumerate() {
                let idx = (i as i64 + j as i64 - 2).clamp(0, old.len() as i64 - 1) as usize;
                sum += k * old[idx].density;
            }
            self.buckets[i].density = sum;
        }
    }
}

// ----------------------------------------------------------------------------
// Panel state
// ----------------------------------------------------------------------------

pub struct RerunTimePanel {
    pub topic_tree: TopicTree,
    pub time_view: TimeView,
    pub playhead: DateTime<Utc>,
    pub playback_state: PlaybackState,
    pub timezone: DisplayTimezone,
    pub selected_event: Option<String>,
    hovered_event: Option<String>,
    collapsed_paths: HashSet<String>,
    config: RerunTimePanelConfig,
    dragging_playhead: bool,
    is_panning: bool,
    last_update: DateTime<Utc>,
}

impl RerunTimePanel {
    pub fn new() -> Self {
        let now = Utc::now();
        Self {
            topic_tree: TopicTree::new(),
            time_view: TimeView::new(now - Duration::minutes(5), now),
            playhead: now,
            playback_state: PlaybackState::Following,
            timezone: DisplayTimezone::UTC,
            selected_event: None,
            hovered_event: None,
            collapsed_paths: HashSet::new(),
            config: RerunTimePanelConfig::default(),
            dragging_playhead: false,
            is_panning: false,
            last_update: now,
        }
    }

    pub fn set_playhead(&mut self, time: DateTime<Utc>) {
        self.playhead = time;
    }

    pub fn set_timezone(&mut self, tz: DisplayTimezone) {
        self.timezone = tz;
    }

    pub fn set_selected(&mut self, event_id: Option<String>) {
        self.selected_event = event_id;
    }

    pub fn is_live(&self) -> bool {
        self.playback_state == PlaybackState::Following
    }

    pub fn update_playback(&mut self) {
        let now = Utc::now();
        match self.playback_state {
            PlaybackState::Following => {
                self.playhead = now;
                self.time_view.expand_to_include(now, 0.1);
            }
            PlaybackState::Playing => {
                let elapsed = now - self.last_update;
                self.playhead += elapsed;
                if self.playhead > self.time_view.end() {
                    self.playback_state = PlaybackState::Paused;
                }
            }
            PlaybackState::Paused => {}
        }
        self.last_update = now;
    }

    pub fn fit_to_events(&mut self, events: &[EventDto]) {
        if events.is_empty() {
            return;
        }
        let times: Vec<DateTime<Utc>> = events.iter().map(|e| e.occurred_at).collect();
        self.time_view.fit_to_times(&times, 0.1);
    }

    pub fn expand_to_include(&mut self, time: DateTime<Utc>) {
        if self.playback_state == PlaybackState::Following {
            self.time_view.expand_to_include(time, 0.1);
        }
    }

    fn update_tree(&mut self, events: &[EventDto]) {
        self.topic_tree = TopicTree::from_events(events);
        for root in &mut self.topic_tree.roots {
            Self::apply_collapsed(root, &self.collapsed_paths);
        }
    }

    fn apply_collapsed(node: &mut TopicTreeNode, collapsed: &HashSet<String>) {
        node.expanded = !collapsed.contains(&node.path.display());
        for child in &mut node.children {
            Self::apply_collapsed(child, collapsed);
        }
    }

    fn toggle_collapsed(&mut self, path: &str) {
        if self.collapsed_paths.contains(path) {
            self.collapsed_paths.remove(path);
        } else {
            self.collapsed_paths.insert(path.to_string());
        }
    }

    fn group_events_by_path<'a>(
        &self,
        events: &'a [EventDto],
    ) -> HashMap<String, Vec<&'a EventDto>> {
        let mut groups: HashMap<String, Vec<&EventDto>> = HashMap::new();
        for event in events {
            let path = TopicPath::from_event(&event.source, &event.event_type);
            groups.entry(path.display()).or_default().push(event);
        }
        groups
    }

    fn group_events_by_source<'a>(
        &self,
        events: &'a [EventDto],
    ) -> HashMap<String, Vec<&'a EventDto>> {
        let mut groups: HashMap<String, Vec<&EventDto>> = HashMap::new();
        for event in events {
            groups.entry(event.source.clone()).or_default().push(event);
        }
        groups
    }

    fn collect_visible_nodes(&self) -> Vec<TopicTreeNode> {
        let mut nodes = Vec::new();
        for root in &self.topic_tree.roots {
            Self::collect_visible_owned(root, &mut nodes);
        }
        nodes
    }

    fn collect_visible_owned(node: &TopicTreeNode, output: &mut Vec<TopicTreeNode>) {
        output.push(node.clone());
        if node.expanded {
            for child in &node.children {
                Self::collect_visible_owned(child, output);
            }
        }
    }

    fn events_for_node<'a>(
        &self,
        node: &TopicTreeNode,
        events_by_path: &'a HashMap<String, Vec<&'a EventDto>>,
        events_by_source: &'a HashMap<String, Vec<&'a EventDto>>,
    ) -> Vec<&'a EventDto> {
        // For source-level nodes (depth == 1), return all events for that source
        if node.path.depth() == 1 {
            events_by_source
                .get(&node.name)
                .cloned()
                .unwrap_or_default()
        } else if node.children.is_empty() {
            // Leaf node - return events for exact path
            events_by_path
                .get(&node.path.display())
                .cloned()
                .unwrap_or_default()
        } else {
            // Container node with children - collect all events from descendants
            let mut result = Vec::new();
            Self::collect_events_recursive(node, events_by_path, &mut result);
            result
        }
    }

    fn collect_events_recursive<'a>(
        node: &TopicTreeNode,
        events_by_path: &'a HashMap<String, Vec<&'a EventDto>>,
        result: &mut Vec<&'a EventDto>,
    ) {
        // Add events at this exact path (if any)
        if let Some(events) = events_by_path.get(&node.path.display()) {
            result.extend(events.iter());
        }
        // Recursively collect from children
        for child in &node.children {
            Self::collect_events_recursive(child, events_by_path, result);
        }
    }

    // ------------------------------------------------------------------------
    // UI
    // ------------------------------------------------------------------------

    pub fn ui(&mut self, ui: &mut Ui, events: &[EventDto]) -> RerunTimePanelResponse {
        let mut response = RerunTimePanelResponse::default();
        self.hovered_event = None;

        self.update_playback();
        self.handle_keyboard_input(ui, &mut response);
        self.render_controls_bar(ui, events, &mut response);

        ui.add_space(spacing::XS);

        self.update_tree(events);
        let events_by_path = self.group_events_by_path(events);
        let events_by_source = self.group_events_by_source(events);
        let visible_nodes = self.collect_visible_nodes();

        let available_width = ui.available_width();
        let timeline_width = (available_width - self.config.label_width).max(100.0);
        let content_height = visible_nodes.len() as f32 * self.config.row_height;
        let total_height = self.config.header_height + content_height;

        let axis_layout = if self.config.collapse_gaps {
            CollapsedTimeAxis::new(
                self.time_view.start(),
                self.time_view.end(),
                events,
                self.config.gap_width,
            )
            .layout(timeline_width)
        } else {
            AxisLayout::linear(self.time_view.start(), self.time_view.end(), timeline_width)
        };

        egui::Frame::none()
            .fill(colors::TIMELINE_BG)
            .rounding(rounding::SM)
            .stroke(Stroke::new(1.0, colors::TIMELINE_SEPARATOR))
            .show(ui, |ui| {
                let (full_rect, full_response) = ui.allocate_exact_size(
                    Vec2::new(
                        available_width,
                        total_height.max(self.config.header_height + 96.0),
                    ),
                    Sense::click_and_drag(),
                );

                let painter = ui.painter_at(full_rect);

                let header_rect = Rect::from_min_size(
                    full_rect.min,
                    Vec2::new(available_width, self.config.header_height),
                );
                let content_rect = Rect::from_min_size(
                    Pos2::new(
                        full_rect.left(),
                        full_rect.top() + self.config.header_height,
                    ),
                    Vec2::new(available_width, content_height.max(96.0)),
                );
                let timeline_header_rect = Rect::from_min_size(
                    Pos2::new(
                        header_rect.left() + self.config.label_width,
                        header_rect.top(),
                    ),
                    Vec2::new(timeline_width, self.config.header_height),
                );

                // Header background
                painter.rect_filled(header_rect, rounding::NONE, colors::BG_ELEVATED);

                // Streams label
                painter.text(
                    pos2(header_rect.left() + spacing::SM, header_rect.center().y),
                    Align2::LEFT_CENTER,
                    "STREAMS",
                    typography::caption(),
                    colors::TEXT_MUTED,
                );

                // Event count
                painter.text(
                    pos2(
                        self.config.label_width - spacing::MD,
                        header_rect.center().y,
                    ),
                    Align2::RIGHT_CENTER,
                    format!("{}", events.len()),
                    typography::mono_small(),
                    colors::ACCENT_TEAL,
                );

                // Separator under header
                painter.hline(
                    full_rect.x_range(),
                    header_rect.bottom(),
                    Stroke::new(1.0, colors::TIMELINE_SEPARATOR),
                );

                // Time axis ticks
                self.paint_time_axis(&painter, &timeline_header_rect, &axis_layout);

                // Rows
                let mut y_offset = 0.0;

                for (row_idx, node) in visible_nodes.iter().enumerate() {
                    let row_rect = Rect::from_min_size(
                        Pos2::new(content_rect.left(), content_rect.top() + y_offset),
                        Vec2::new(available_width, self.config.row_height),
                    );

                    let all_node_events =
                        self.events_for_node(node, &events_by_path, &events_by_source);
                    let event_count = all_node_events.len();
                    let show_density = node.children.is_empty() || !node.expanded;
                    let node_events: &[&EventDto] =
                        if show_density { &all_node_events } else { &[] };
                    let (event_clicked, chevron_clicked) = self.render_row(
                        ui,
                        &painter,
                        row_rect,
                        node,
                        node.path.depth().saturating_sub(1),
                        row_idx,
                        node_events,
                        event_count,
                        &axis_layout,
                    );

                    if let Some(event_id) = event_clicked {
                        response.clicked_event_id = Some(event_id);
                    }
                    if chevron_clicked {
                        self.toggle_collapsed(&node.path.display());
                    }

                    y_offset += self.config.row_height;
                }

                // Gap markers in content area
                let content_timeline_rect = Rect::from_min_size(
                    Pos2::new(
                        content_rect.left() + self.config.label_width,
                        content_rect.top(),
                    ),
                    Vec2::new(timeline_width, content_height.max(96.0)),
                );
                self.paint_gap_markers(&painter, &content_timeline_rect, &axis_layout);

                // Paint shadow separator between tree and timeline (Rerun-style)
                {
                    let shadow_width = 30.0;
                    let shadow_x = full_rect.left() + self.config.label_width;
                    let shadow_rect = Rect::from_x_y_ranges(
                        shadow_x..=(shadow_x + shadow_width),
                        full_rect.y_range(),
                    );
                    self.paint_shadow_line(&painter, shadow_rect);
                }

                // Playhead
                let playhead_rect = Rect::from_min_max(
                    Pos2::new(full_rect.left() + self.config.label_width, full_rect.top()),
                    full_rect.max,
                );
                self.paint_playhead(&painter, &playhead_rect, &axis_layout);

                // Interactions
                let pointer_pos = ui.ctx().pointer_hover_pos();
                let playhead_x =
                    playhead_rect.left() + axis_layout.x_from_time(self.playhead) as f32;
                let playhead_hit_rect = Rect::from_center_size(
                    Pos2::new(playhead_x, header_rect.center().y),
                    Vec2::new(20.0, self.config.header_height),
                );

                if full_response.drag_started() {
                    if let Some(pos) = pointer_pos {
                        if playhead_hit_rect.contains(pos) {
                            self.dragging_playhead = true;
                        } else if playhead_rect.contains(pos) {
                            self.is_panning = true;
                        }
                    }
                }

                if full_response.dragged() {
                    if let Some(pos) = pointer_pos {
                        if self.dragging_playhead {
                            let x = (pos.x - playhead_rect.left()).clamp(0.0, timeline_width);
                            let new_time = axis_layout.time_from_x(x);
                            self.playhead = new_time;
                            self.playback_state = PlaybackState::Paused;
                            response.playhead_changed = true;
                            response.new_playhead = Some(new_time);
                        } else if self.is_panning {
                            let delta = full_response.drag_delta();
                            let duration_ms = self.time_view.duration().num_milliseconds().max(1);
                            let pixels_per_ms = timeline_width / duration_ms as f32;
                            self.time_view.pan_by_pixels(delta.x, pixels_per_ms);
                            response.view_panned = true;
                        }
                    }
                }

                if full_response.drag_stopped() {
                    self.dragging_playhead = false;
                    self.is_panning = false;
                }

                if full_response.clicked() && !self.dragging_playhead && !self.is_panning {
                    if let Some(pos) = pointer_pos {
                        if playhead_rect.contains(pos) {
                            let x = (pos.x - playhead_rect.left()).clamp(0.0, timeline_width);
                            let new_time = axis_layout.time_from_x(x);
                            self.playhead = new_time;
                            self.playback_state = PlaybackState::Paused;
                            response.playhead_changed = true;
                            response.new_playhead = Some(new_time);
                        }
                    }
                }

                if full_response.double_clicked() {
                    self.fit_to_events(events);
                    response.view_panned = true;
                }

                let scroll = ui.input(|i| i.raw_scroll_delta);
                if scroll.y.abs() > 0.1 && full_response.hovered() {
                    if let Some(pos) = pointer_pos {
                        if playhead_rect.contains(pos) {
                            let anchor_x = pos.x - playhead_rect.left();
                            let anchor_time = axis_layout.time_from_x(anchor_x);
                            let zoom_factor = if scroll.y > 0.0 { 1.1 } else { 0.9 };
                            self.time_view.zoom_at(anchor_time, zoom_factor);
                            response.view_zoomed = true;
                        }
                    }
                }

                if scroll.x.abs() > 0.1 && full_response.hovered() {
                    let duration_ms = self.time_view.duration().num_milliseconds().max(1);
                    let ms_per_pixel = duration_ms as f32 / timeline_width;
                    self.time_view.pan((-scroll.x * ms_per_pixel) as i64);
                    response.view_panned = true;
                }

                let zoom = ui.input(|i| i.zoom_delta());
                if zoom != 1.0 {
                    if let Some(pos) = pointer_pos {
                        if playhead_rect.contains(pos) {
                            let anchor_x = pos.x - playhead_rect.left();
                            let anchor_time = axis_layout.time_from_x(anchor_x);
                            self.time_view.zoom_at(anchor_time, zoom);
                            response.view_zoomed = true;
                        }
                    }
                }
            });

        if let Some(hovered_id) = &self.hovered_event {
            if let Some(event) = events.iter().find(|e| &e.event_id == hovered_id) {
                egui::show_tooltip(
                    ui.ctx(),
                    ui.layer_id(),
                    egui::Id::new("rerun_time_event_tooltip"),
                    |ui| {
                        self.render_event_tooltip(ui, event);
                    },
                );
            }
        }

        response
    }

    // ------------------------------------------------------------------------
    // Rendering helpers
    // ------------------------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    fn render_row(
        &mut self,
        ui: &mut Ui,
        painter: &egui::Painter,
        rect: Rect,
        node: &TopicTreeNode,
        depth: usize,
        row_idx: usize,
        events: &[&EventDto],
        event_count: usize,
        axis: &AxisLayout,
    ) -> (Option<String>, bool) {
        let mut clicked_event_id = None;
        let mut chevron_clicked = false;

        let row_id = egui::Id::new("rerun_time_row")
            .with(row_idx)
            .with(&node.name)
            .with(node.path.display());
        let row_response = ui.interact(rect, row_id, Sense::click());

        let is_hovered = row_response.hovered();
        let is_selected = self
            .selected_event
            .as_ref()
            .and_then(|id| events.iter().find(|e| e.event_id == *id))
            .is_some();

        let bg_color = if is_selected {
            colors::TIMELINE_ROW_SELECTED
        } else if is_hovered {
            colors::TIMELINE_ROW_HOVER
        } else if row_idx.is_multiple_of(2) {
            colors::TIMELINE_BG
        } else {
            colors::TIMELINE_ROW_ALT
        };
        painter.rect_filled(rect, rounding::NONE, bg_color);
        painter.hline(
            rect.x_range(),
            rect.bottom(),
            Stroke::new(1.0, colors::TIMELINE_SEPARATOR),
        );
        painter.vline(
            rect.left() + self.config.label_width,
            rect.y_range(),
            Stroke::new(1.0, colors::TIMELINE_SEPARATOR),
        );

        if depth > 0 {
            let guide_x =
                rect.left() + spacing::SM + (depth as f32 - 1.0) * self.config.indent_size + 4.0;
            painter.vline(
                guide_x,
                rect.y_range(),
                Stroke::new(1.0, colors::TREE_INDENT_GUIDE),
            );
        }

        let indent = spacing::SM + depth as f32 * self.config.indent_size;
        let chevron_size = 10.0;

        if !node.children.is_empty() {
            let chevron_center =
                Pos2::new(rect.left() + indent + chevron_size / 2.0, rect.center().y);
            let chevron_text = if node.expanded { "▾" } else { "▸" };
            painter.text(
                chevron_center,
                Align2::CENTER_CENTER,
                chevron_text,
                typography::small(),
                colors::TREE_CHEVRON,
            );

            let chevron_rect =
                Rect::from_center_size(chevron_center, Vec2::splat(chevron_size + 4.0));
            let chevron_id = egui::Id::new("rerun_time_chevron")
                .with(row_idx)
                .with(depth)
                .with(&node.name);
            let chevron_response = ui.interact(chevron_rect, chevron_id, Sense::click());
            if chevron_response.clicked() {
                chevron_clicked = true;
            }
        }

        // Entity icon (Rerun-style) based on node type
        let icon_x = rect.left() + indent + chevron_size + spacing::XS;
        let icon_center = Pos2::new(icon_x + 6.0, rect.center().y);
        let icon = if depth == 0 {
            "🔷" // Source/root entity
        } else if !node.children.is_empty() {
            "📁" // Container/folder
        } else {
            "📄" // Leaf/component
        };
        painter.text(
            icon_center,
            Align2::CENTER_CENTER,
            icon,
            typography::caption(),
            colors::TEXT_MUTED,
        );

        let color_rect = Rect::from_min_size(
            Pos2::new(icon_x + 16.0, rect.center().y - 3.0),
            Vec2::new(6.0, 6.0),
        );
        painter.rect_filled(color_rect, rounding::NONE, node.color);

        let name_pos = Pos2::new(color_rect.right() + spacing::XS, rect.center().y);
        let name_font = if depth == 0 {
            typography::small()
        } else {
            typography::caption()
        };
        let name_color = if depth == 0 {
            colors::TEXT_PRIMARY
        } else {
            colors::TEXT_SECONDARY
        };
        // Rerun-style: add "/" suffix to non-leaf nodes
        let display_name = if !node.children.is_empty() {
            format!("{}/", node.name)
        } else {
            node.name.clone()
        };
        painter.text(
            name_pos,
            Align2::LEFT_CENTER,
            &display_name,
            name_font,
            name_color,
        );

        if self.config.show_counts && event_count > 0 {
            painter.text(
                Pos2::new(self.config.label_width - spacing::MD, rect.center().y),
                Align2::RIGHT_CENTER,
                format!("{}", event_count),
                typography::caption(),
                colors::TEXT_MUTED,
            );
        }

        let timeline_rect = Rect::from_min_size(
            Pos2::new(rect.left() + self.config.label_width, rect.top()),
            Vec2::new(
                rect.width() - self.config.label_width,
                self.config.row_height,
            ),
        );
        self.paint_row_density_simple(painter, &timeline_rect, axis, events);

        if let Some((event_id, _)) = self.find_hovered_event(ui, &timeline_rect, axis, events) {
            self.hovered_event = Some(event_id.clone());
        }

        if row_response.clicked() {
            if let Some((event_id, _)) = self.find_hovered_event(ui, &timeline_rect, axis, events) {
                clicked_event_id = Some(event_id);
            }
        }

        (clicked_event_id, chevron_clicked)
    }

    /// Simple density graph painting that doesn't need mutable self
    /// Uses Rerun-style smooth waveform rendering
    fn paint_row_density_simple(
        &self,
        painter: &egui::Painter,
        rect: &Rect,
        axis: &AxisLayout,
        events: &[&EventDto],
    ) {
        if events.is_empty() {
            return;
        }

        // Build density graph
        let mut density_graph = DensityGraph::new(Rangef::new(rect.left(), rect.right()));

        for event in events {
            let x = rect.left() + axis.x_from_time(event.occurred_at) as f32;
            if x >= rect.left() && x <= rect.right() {
                density_graph.add_point(x, 1.0);
            }
        }

        // Smooth the density (Rerun-style blur)
        density_graph.smooth();

        // Paint using simplified mesh-based waveform (no normalization)
        self.paint_density_graph_simple(
            painter,
            &density_graph,
            rect.y_range(),
            colors::ACCENT_TEAL,
        );
    }

    /// Paint density graph as symmetric waveform (simplified version)
    fn paint_density_graph_simple(
        &self,
        painter: &egui::Painter,
        graph: &DensityGraph,
        y_range: Rangef,
        color: Color32,
    ) {
        let center_y = (y_range.min + y_range.max) / 2.0;
        let max_radius = (y_range.max - y_range.min) / 2.0;
        let feather = 0.5 / painter.ctx().pixels_per_point();

        // Find max density for normalization
        let max_density = graph
            .buckets
            .iter()
            .map(|b| b.density)
            .fold(0.0f32, |a, b| a.max(b))
            .max(1.0);

        let uv = egui::Pos2::ZERO;
        let mut mesh = egui::Mesh::default();
        mesh.vertices.reserve(4 * graph.buckets.len());

        for (i, bucket) in graph.buckets.iter().enumerate() {
            let x = graph.x_from_bucket_index(i);
            let normalized = (bucket.density / max_density).min(1.0);

            let (inner_radius, inner_color) = if normalized < 0.01 {
                (0.0, Color32::TRANSPARENT)
            } else {
                let min_radius = 1.5;
                let r = (max_radius * normalized).max(min_radius) - feather;
                let c = color.gamma_multiply(0.5 + 0.5 * normalized);
                (r, c)
            };
            let outer_radius = inner_radius + feather;

            mesh.vertices.extend_from_slice(&[
                Vertex {
                    pos: pos2(x, center_y - outer_radius),
                    color: Color32::TRANSPARENT,
                    uv,
                },
                Vertex {
                    pos: pos2(x, center_y - inner_radius),
                    color: inner_color,
                    uv,
                },
                Vertex {
                    pos: pos2(x, center_y + inner_radius),
                    color: inner_color,
                    uv,
                },
                Vertex {
                    pos: pos2(x, center_y + outer_radius),
                    color: Color32::TRANSPARENT,
                    uv,
                },
            ]);
        }

        // Build triangle indices
        mesh.indices
            .reserve(6 * 3 * (graph.buckets.len().saturating_sub(1)));
        for i in 1..graph.buckets.len() {
            let i = i as u32;
            let base = 4 * (i - 1);
            mesh.indices.extend_from_slice(&[
                base,
                base + 1,
                base + 4,
                base + 1,
                base + 4,
                base + 5,
                base + 1,
                base + 2,
                base + 5,
                base + 2,
                base + 5,
                base + 6,
                base + 2,
                base + 3,
                base + 6,
                base + 3,
                base + 6,
                base + 7,
            ]);
        }

        painter.add(Shape::Mesh(mesh));
    }

    fn find_hovered_event(
        &self,
        ui: &Ui,
        rect: &Rect,
        axis: &AxisLayout,
        events: &[&EventDto],
    ) -> Option<(String, DateTime<Utc>)> {
        let pointer_pos = ui.ctx().pointer_hover_pos()?;
        if !rect.contains(pointer_pos) {
            return None;
        }
        let local_x = (pointer_pos.x - rect.left()).clamp(0.0, rect.width());
        let hover_time = axis.time_from_x(local_x);
        let mut closest: Option<(&EventDto, i64)> = None;
        for event in events {
            let dist = (event.occurred_at - hover_time).num_milliseconds().abs();
            if closest.map(|(_, d)| dist < d).unwrap_or(true) {
                closest = Some((event, dist));
            }
        }
        if let Some((event, dist)) = closest {
            if dist <= 200 {
                return Some((event.event_id.clone(), event.occurred_at));
            }
        }
        None
    }

    fn paint_time_axis(&self, painter: &egui::Painter, rect: &Rect, axis: &AxisLayout) {
        let start = self.time_view.start();
        let end = self.time_view.end();
        let duration_secs = (end - start).num_seconds() as f64;
        let (major_interval, minor_count) = if duration_secs <= 60.0 {
            (Duration::seconds(10), 2)
        } else if duration_secs <= 300.0 {
            (Duration::seconds(30), 3)
        } else if duration_secs <= 3600.0 {
            (Duration::minutes(1), 4)
        } else if duration_secs <= 14400.0 {
            (Duration::minutes(10), 5)
        } else {
            (Duration::hours(1), 6)
        };

        let major_ms = major_interval.num_milliseconds();
        let start_ms = start.timestamp_millis();
        let end_ms = end.timestamp_millis();
        let first_tick_ms = ((start_ms / major_ms) * major_ms) + major_ms;

        let tick_color = colors::TIMELINE_TICK;
        let label_color = colors::TIMELINE_TICK_LABEL;

        let mut tick_ms = first_tick_ms;
        while tick_ms <= end_ms {
            let tick_time = DateTime::from_timestamp_millis(tick_ms).unwrap_or(start);
            let x = rect.left() + axis.x_from_time(tick_time) as f32;
            if rect.x_range().contains(x) {
                painter.vline(
                    x,
                    (rect.bottom() - 8.0)..=rect.bottom(),
                    Stroke::new(1.0, tick_color),
                );
                let label = if duration_secs <= 60.0 {
                    tick_time.format("%S").to_string()
                } else if duration_secs <= 3600.0 {
                    tick_time.format("%M:%S").to_string()
                } else {
                    tick_time.format("%H:%M").to_string()
                };
                painter.text(
                    Pos2::new(x, rect.bottom() - 2.0),
                    Align2::CENTER_BOTTOM,
                    label,
                    typography::mono_small(),
                    label_color,
                );
            }

            if minor_count > 0 {
                let minor_interval = major_ms / minor_count as i64;
                for i in 1..minor_count {
                    let minor_ms = tick_ms - major_ms + (minor_interval * i as i64);
                    if minor_ms > start_ms && minor_ms < end_ms {
                        let minor_time = DateTime::from_timestamp_millis(minor_ms).unwrap_or(start);
                        let minor_x = rect.left() + axis.x_from_time(minor_time) as f32;
                        if rect.x_range().contains(minor_x) {
                            painter.vline(
                                minor_x,
                                (rect.bottom() - 4.0)..=rect.bottom(),
                                Stroke::new(1.0, colors::TIMELINE_SEPARATOR),
                            );
                        }
                    }
                }
            }

            tick_ms += major_ms;
        }
    }

    fn paint_gap_markers(&self, painter: &egui::Painter, rect: &Rect, axis: &AxisLayout) {
        for (gap_start, gap_end) in axis.gaps.iter() {
            let left = rect.left() + *gap_start;
            let right = rect.left() + *gap_end;
            let y_top = rect.top();
            let y_bottom = rect.bottom();

            let zig = 4.0;
            let mut y = y_top;
            let mut points_left = Vec::new();
            let mut points_right = Vec::new();
            let mut row = 0;
            while y <= y_bottom {
                let offset = if row % 2 == 0 { 0.0 } else { zig };
                points_left.push(pos2(left + offset, y));
                points_right.push(pos2(right - offset, y));
                y += zig;
                row += 1;
            }
            painter.add(egui::Shape::line(
                points_left,
                Stroke::new(1.0, colors::TIMELINE_SEPARATOR),
            ));
            painter.add(egui::Shape::line(
                points_right,
                Stroke::new(1.0, colors::TIMELINE_SEPARATOR),
            ));
        }
    }

    /// Paint a gradient shadow from left to right (Rerun-style separator)
    fn paint_shadow_line(&self, painter: &egui::Painter, rect: Rect) {
        let start_color = Color32::from_black_alpha(40);
        let end_color = Color32::TRANSPARENT;

        let uv = egui::Pos2::ZERO;
        let mut mesh = egui::Mesh::default();

        // Two vertices on each side: top and bottom
        mesh.vertices.push(Vertex {
            pos: rect.left_top(),
            color: start_color,
            uv,
        });
        mesh.vertices.push(Vertex {
            pos: rect.left_bottom(),
            color: start_color,
            uv,
        });
        mesh.vertices.push(Vertex {
            pos: rect.right_top(),
            color: end_color,
            uv,
        });
        mesh.vertices.push(Vertex {
            pos: rect.right_bottom(),
            color: end_color,
            uv,
        });

        // Two triangles to form the quad
        mesh.indices.extend_from_slice(&[0, 1, 2, 1, 2, 3]);

        painter.add(Shape::Mesh(mesh));
    }

    fn paint_playhead(&self, painter: &egui::Painter, rect: &Rect, axis: &AxisLayout) {
        let x = rect.left() + axis.x_from_time(self.playhead) as f32;
        if !rect.x_range().contains(x) {
            return;
        }
        let color = if self.is_live() {
            colors::PLAYHEAD_LIVE
        } else {
            colors::PLAYHEAD
        };
        painter.vline(x, rect.top()..=rect.bottom(), Stroke::new(2.0, color));
    }

    fn render_event_tooltip(&self, ui: &mut Ui, event: &EventDto) {
        ui.vertical(|ui| {
            ui.set_max_width(280.0);

            let path = TopicPath::from_event(&event.source, &event.event_type);
            ui.horizontal(|ui| {
                let (rect, _) = ui.allocate_exact_size(egui::vec2(6.0, 6.0), Sense::hover());
                ui.painter()
                    .rect_filled(rect, rounding::NONE, colors::TIMELINE_DOT);
                ui.label(
                    egui::RichText::new(path.display())
                        .color(colors::TEXT_PRIMARY)
                        .font(typography::body())
                        .strong(),
                );
            });

            ui.add_space(spacing::XS);
            ui.label(
                egui::RichText::new(event.occurred_at.format("%H:%M:%S%.3f").to_string())
                    .color(colors::TEXT_SECONDARY)
                    .font(typography::mono_small()),
            );

            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("ACTOR")
                        .color(colors::TEXT_MUTED)
                        .font(typography::caption()),
                );
                ui.label(
                    egui::RichText::new(event.actor_display())
                        .color(colors::TEXT_PRIMARY)
                        .font(typography::small()),
                );
            });

            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("SOURCE")
                        .color(colors::TEXT_MUTED)
                        .font(typography::caption()),
                );
                ui.label(
                    egui::RichText::new(&event.source)
                        .color(colors::TEXT_PRIMARY)
                        .font(typography::small()),
                );
            });

            if let Some(text) = event.message_text() {
                ui.add_space(spacing::XS);
                let preview: String = text.chars().take(80).collect();
                let preview = if text.len() > 80 {
                    format!("{}…", preview)
                } else {
                    preview
                };
                ui.label(
                    egui::RichText::new(preview)
                        .color(colors::TEXT_MUTED)
                        .font(typography::small())
                        .italics(),
                );
            }

            ui.add_space(spacing::XS);
            ui.label(
                egui::RichText::new("Click to select")
                    .color(colors::TEXT_DISABLED)
                    .font(typography::caption()),
            );
        });
    }

    fn render_controls_bar(
        &mut self,
        ui: &mut Ui,
        events: &[EventDto],
        response: &mut RerunTimePanelResponse,
    ) {
        let is_live = self.playback_state == PlaybackState::Following;

        egui::Frame::none()
            .fill(colors::BG_SURFACE)
            .rounding(rounding::SM)
            .stroke(Stroke::new(1.0, colors::BORDER_SUBTLE))
            .inner_margin(egui::Margin::symmetric(spacing::SM, spacing::XS))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    // Left side - Playback controls
                    ui.horizontal(|ui| {
                        let live_btn = egui::Button::new(
                            egui::RichText::new("◉ LIVE")
                                .color(if is_live {
                                    colors::SIGNAL_GREEN
                                } else {
                                    colors::TEXT_MUTED
                                })
                                .font(typography::caption())
                                .strong(),
                        )
                        .fill(if is_live {
                            colors::BG_ACTIVE
                        } else {
                            colors::BG_CONTROL
                        });

                        if ui.add(live_btn).clicked() {
                            self.playback_state = PlaybackState::Following;
                            response.playhead_changed = true;
                        }

                        ui.add_space(spacing::XS);

                        let is_playing = self.playback_state == PlaybackState::Playing;
                        let play_icon = if is_playing { "⏸" } else { "▶" };
                        let play_text = if is_playing { "PAUSE" } else { "PLAY" };
                        let play_btn = egui::Button::new(
                            egui::RichText::new(format!("{} {}", play_icon, play_text))
                                .color(if is_playing {
                                    colors::ACCENT_TEAL
                                } else {
                                    colors::TEXT_SECONDARY
                                })
                                .font(typography::caption()),
                        )
                        .fill(colors::BG_CONTROL);

                        if ui.add(play_btn).clicked() {
                            if is_playing {
                                self.playback_state = PlaybackState::Paused;
                            } else {
                                self.playback_state = PlaybackState::Playing;
                            }
                            response.playhead_changed = true;
                        }

                        ui.add_space(spacing::SM);

                        if ui
                            .button(egui::RichText::new("⏮").font(typography::small()))
                            .clicked()
                        {
                            if let Some(first) = events.first() {
                                self.playhead = first.occurred_at;
                                self.playback_state = PlaybackState::Paused;
                                response.playhead_changed = true;
                            }
                        }

                        if ui
                            .button(egui::RichText::new("⏭").font(typography::small()))
                            .clicked()
                        {
                            if let Some(last) = events.last() {
                                self.playhead = last.occurred_at;
                                self.playback_state = PlaybackState::Paused;
                                response.playhead_changed = true;
                            }
                        }
                    });

                    ui.add_space(spacing::MD);
                    ui.separator();
                    ui.add_space(spacing::MD);

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        egui::ComboBox::from_id_salt("rerun_time_timezone")
                            .selected_text(self.timezone.short_label())
                            .width(70.0)
                            .show_ui(ui, |ui| {
                                for &tz in DisplayTimezone::all() {
                                    if ui
                                        .selectable_label(self.timezone == tz, tz.label())
                                        .clicked()
                                    {
                                        self.timezone = tz;
                                    }
                                }
                            });

                        ui.add_space(spacing::SM);

                        let display_time = if is_live { Utc::now() } else { self.playhead };
                        let time_str = self.timezone.format_time(display_time);
                        let date_str = self
                            .timezone
                            .convert(display_time)
                            .format("%Y-%m-%d")
                            .to_string();
                        let time_color = if is_live {
                            colors::SIGNAL_GREEN
                        } else {
                            colors::ACCENT_TEAL
                        };

                        ui.label(
                            egui::RichText::new(&time_str)
                                .color(time_color)
                                .font(typography::mono())
                                .strong(),
                        );
                        ui.label(
                            egui::RichText::new(&date_str)
                                .color(colors::TEXT_SECONDARY)
                                .font(typography::mono_small()),
                        );

                        ui.add_space(spacing::MD);

                        let duration_str = format_duration(self.time_view.duration());
                        ui.label(
                            egui::RichText::new(duration_str)
                                .color(colors::TEXT_SECONDARY)
                                .font(typography::mono_small()),
                        );
                        ui.label(
                            egui::RichText::new("RANGE")
                                .color(colors::TEXT_MUTED)
                                .font(typography::caption()),
                        );
                    });
                });
            });
    }

    fn handle_keyboard_input(&mut self, ui: &Ui, response: &mut RerunTimePanelResponse) {
        let ctx = ui.ctx();

        if ctx.input(|i| i.key_pressed(egui::Key::Space)) {
            match self.playback_state {
                PlaybackState::Playing => self.playback_state = PlaybackState::Paused,
                PlaybackState::Paused => self.playback_state = PlaybackState::Playing,
                PlaybackState::Following => self.playback_state = PlaybackState::Paused,
            }
            response.playhead_changed = true;
        }

        if ctx.input(|i| i.key_pressed(egui::Key::L)) {
            if self.playback_state == PlaybackState::Following {
                self.playback_state = PlaybackState::Paused;
            } else {
                self.playback_state = PlaybackState::Following;
            }
            response.playhead_changed = true;
        }

        if ctx.input(|i| i.key_pressed(egui::Key::Home)) {
            self.playhead = self.time_view.start();
            self.playback_state = PlaybackState::Paused;
            response.playhead_changed = true;
        }

        if ctx.input(|i| i.key_pressed(egui::Key::End)) {
            self.playhead = self.time_view.end();
            self.playback_state = PlaybackState::Paused;
            response.playhead_changed = true;
        }

        let step_ms = (self.time_view.duration().num_milliseconds() / 50).max(100);
        if ctx.input(|i| i.key_pressed(egui::Key::ArrowLeft)) {
            self.playhead -= Duration::milliseconds(step_ms);
            self.playback_state = PlaybackState::Paused;
            response.playhead_changed = true;
        }
        if ctx.input(|i| i.key_pressed(egui::Key::ArrowRight)) {
            self.playhead += Duration::milliseconds(step_ms);
            self.playback_state = PlaybackState::Paused;
            response.playhead_changed = true;
        }
    }
}

impl Default for RerunTimePanel {
    fn default() -> Self {
        Self::new()
    }
}

// ----------------------------------------------------------------------------
// Collapsed time axis (gap collapsing)
// ----------------------------------------------------------------------------

#[derive(Clone, Copy)]
struct TimeRangeMs {
    start_ms: i64,
    end_ms: i64,
}

struct CollapsedTimeAxis {
    ranges: Vec<TimeRangeMs>,
    gap_width: f32,
}

impl CollapsedTimeAxis {
    fn new(start: DateTime<Utc>, end: DateTime<Utc>, events: &[EventDto], gap_width: f32) -> Self {
        let mut times: Vec<i64> = events
            .iter()
            .map(|e| e.occurred_at.timestamp_millis())
            .filter(|t| *t >= start.timestamp_millis() && *t <= end.timestamp_millis())
            .collect();
        times.push(start.timestamp_millis());
        times.push(end.timestamp_millis());
        times.sort_unstable();
        times.dedup();

        let ranges = build_time_ranges(&times);

        Self { ranges, gap_width }
    }

    fn layout(&self, width: f32) -> AxisLayout {
        if self.ranges.is_empty() {
            return AxisLayout::default();
        }

        let total_time: i64 = self
            .ranges
            .iter()
            .map(|r| (r.end_ms - r.start_ms).max(1))
            .sum();
        let gaps = self.ranges.len().saturating_sub(1);
        let usable_width = (width - self.gap_width * gaps as f32).max(1.0);

        let mut segments = Vec::new();
        let mut gap_positions = Vec::new();
        let mut cursor_x = 0.0;

        for (idx, range) in self.ranges.iter().enumerate() {
            let duration = (range.end_ms - range.start_ms).max(1) as f32;
            let seg_width = (duration / total_time as f32) * usable_width;
            let x_start = cursor_x;
            let x_end = (cursor_x + seg_width).max(x_start + 1.0);

            segments.push(AxisSegment {
                start_ms: range.start_ms,
                end_ms: range.end_ms,
                x_start,
                x_end,
            });

            cursor_x = x_end;
            if idx + 1 < self.ranges.len() {
                gap_positions.push((cursor_x, cursor_x + self.gap_width));
                cursor_x += self.gap_width;
            }
        }

        AxisLayout {
            segments,
            gaps: gap_positions,
        }
    }
}

#[derive(Default)]
struct AxisLayout {
    segments: Vec<AxisSegment>,
    gaps: Vec<(f32, f32)>,
}

#[derive(Clone, Copy)]
struct AxisSegment {
    start_ms: i64,
    end_ms: i64,
    x_start: f32,
    x_end: f32,
}

impl AxisLayout {
    fn linear(start: DateTime<Utc>, end: DateTime<Utc>, width: f32) -> Self {
        let start_ms = start.timestamp_millis();
        let end_ms = end.timestamp_millis().max(start_ms + 1);
        Self {
            segments: vec![AxisSegment {
                start_ms,
                end_ms,
                x_start: 0.0,
                x_end: width.max(1.0),
            }],
            gaps: Vec::new(),
        }
    }

    fn x_from_time(&self, time: DateTime<Utc>) -> f64 {
        let time_ms = time.timestamp_millis();
        for seg in &self.segments {
            if time_ms <= seg.end_ms {
                let t = ((time_ms - seg.start_ms) as f32
                    / (seg.end_ms - seg.start_ms).max(1) as f32)
                    .clamp(0.0, 1.0);
                return (seg.x_start + t * (seg.x_end - seg.x_start)) as f64;
            }
        }
        self.segments
            .last()
            .map(|seg| seg.x_end as f64)
            .unwrap_or(0.0)
    }

    fn time_from_x(&self, x: f32) -> DateTime<Utc> {
        for seg in &self.segments {
            if x <= seg.x_end {
                let t = ((x - seg.x_start) / (seg.x_end - seg.x_start).max(1.0)).clamp(0.0, 1.0);
                let time_ms = seg.start_ms + ((seg.end_ms - seg.start_ms).max(1) as f32 * t) as i64;
                return DateTime::from_timestamp_millis(time_ms).unwrap_or_else(Utc::now);
            }
        }
        self.segments
            .last()
            .and_then(|seg| DateTime::from_timestamp_millis(seg.end_ms))
            .unwrap_or_else(Utc::now)
    }
}

fn build_time_ranges(times: &[i64]) -> Vec<TimeRangeMs> {
    if times.is_empty() {
        return Vec::new();
    }
    let gap_threshold = gap_size_heuristic(times);
    let mut ranges = Vec::new();
    let mut current_start = times[0];
    let mut current_end = times[0];

    for time in times.iter().skip(1) {
        let gap = time.saturating_sub(current_end);
        if gap < gap_threshold {
            current_end = *time;
        } else {
            ranges.push(TimeRangeMs {
                start_ms: current_start,
                end_ms: current_end,
            });
            current_start = *time;
            current_end = *time;
        }
    }

    ranges.push(TimeRangeMs {
        start_ms: current_start,
        end_ms: current_end,
    });

    ranges
}

fn gap_size_heuristic(times: &[i64]) -> i64 {
    if times.len() <= 2 {
        return i64::MAX;
    }
    let min = *times.first().unwrap_or(&0);
    let max = *times.last().unwrap_or(&0);
    let total_span = max - min;
    if total_span == 0 {
        return i64::MAX;
    }

    let max_collapses = ((times.len() - 1) / 3).min(20);
    let min_gap_size = 100; // 100ms minimum gap (rerun-like)

    let mut gaps: Vec<i64> = times
        .windows(2)
        .map(|w| (w[1] - w[0]).max(0))
        .filter(|g| *g > min_gap_size)
        .collect();
    gaps.sort_unstable();

    let min_collapse_fraction = (2.0 / (times.len() - 1) as f64).max(0.35);
    let mut gap_threshold = i64::MAX;
    let mut uncollapsed_time = total_span as f64;

    for gap in gaps.iter().rev().take(max_collapses) {
        let gap_fraction = *gap as f64 / uncollapsed_time;
        if gap_fraction > min_collapse_fraction {
            gap_threshold = *gap;
            uncollapsed_time -= *gap as f64;
        } else {
            break;
        }
    }

    gap_threshold
}
