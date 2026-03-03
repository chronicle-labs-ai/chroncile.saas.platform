//! Timeline Panel
//!
//! The main timeline panel widget that can display any event type
//! implementing the TimelineEventData trait.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Duration, Utc};
use egui::{Align2, Pos2, Rect, RichText, Sense, Stroke, Ui, Vec2};

use crate::event::TimelineEventData;
use crate::playback::PlaybackState;
use crate::theme::TimelineTheme;
use crate::time_view::TimeView;
use crate::timezone::DisplayTimezone;
use crate::topic_tree::{source_color, TopicPath, TopicTree, TopicTreeNode};

/// Configuration for the timeline panel
#[derive(Clone, Debug)]
pub struct TimelinePanelConfig {
    pub row_height: f32,
    pub header_height: f32,
    pub label_width: f32,
    pub indent_size: f32,
    pub show_controls: bool,
    pub show_tree: bool,
}

impl Default for TimelinePanelConfig {
    fn default() -> Self {
        Self {
            row_height: 26.0,
            header_height: 32.0,
            label_width: 200.0,
            indent_size: 16.0,
            show_controls: true,
            show_tree: true,
        }
    }
}

/// Response from the timeline panel
#[derive(Default)]
pub struct TimelinePanelResponse {
    /// Event was clicked/selected
    pub selected_event: Option<String>,
    /// Playhead time changed
    pub playhead_changed: bool,
    /// Time range changed (pan/zoom)
    pub range_changed: bool,
}

/// The main timeline panel widget
pub struct TimelinePanel<T: TimelineEventData> {
    // Configuration
    pub config: TimelinePanelConfig,
    pub theme: TimelineTheme,

    // State
    pub time_view: TimeView,
    pub playhead: DateTime<Utc>,
    pub playback_state: PlaybackState,
    pub selected_event: Option<String>,
    pub timezone: DisplayTimezone,

    // Internal state
    topic_tree: TopicTree,
    collapsed_paths: HashSet<String>,
    hovered_event: Option<String>,
    is_panning: bool,
    last_update: DateTime<Utc>,

    // Phantom data for the event type
    _event_type: std::marker::PhantomData<T>,
}

impl<T: TimelineEventData> TimelinePanel<T> {
    /// Create a new timeline panel with default configuration
    pub fn new() -> Self {
        Self::with_config(TimelinePanelConfig::default(), TimelineTheme::default())
    }

    /// Create a new timeline panel with custom configuration
    pub fn with_config(config: TimelinePanelConfig, theme: TimelineTheme) -> Self {
        let now = Utc::now();
        Self {
            config,
            theme,
            time_view: TimeView::now_centered(Duration::hours(1)),
            playhead: now,
            playback_state: PlaybackState::Paused,
            selected_event: None,
            timezone: DisplayTimezone::UTC,
            topic_tree: TopicTree::new(),
            collapsed_paths: HashSet::new(),
            hovered_event: None,
            is_panning: false,
            last_update: now,
            _event_type: std::marker::PhantomData,
        }
    }

    /// Set the playhead position
    pub fn set_playhead(&mut self, time: DateTime<Utc>) {
        self.playhead = time;
    }

    /// Set the timezone
    pub fn set_timezone(&mut self, tz: DisplayTimezone) {
        self.timezone = tz;
    }

    /// Set the selected event
    pub fn set_selected(&mut self, event_id: Option<String>) {
        self.selected_event = event_id;
    }

    /// Check if in live mode
    pub fn is_live(&self) -> bool {
        self.playback_state == PlaybackState::Following
    }

    /// Update playback state based on elapsed time
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

    /// Fit the view to show all events
    pub fn fit_to_events(&mut self, events: &[T]) {
        if events.is_empty() {
            return;
        }
        let times: Vec<DateTime<Utc>> = events.iter().map(|e| e.occurred_at()).collect();
        self.time_view.fit_to_times(&times, 0.1);
    }

    /// Expand view to include a time
    pub fn expand_to_include(&mut self, time: DateTime<Utc>) {
        if self.playback_state == PlaybackState::Following {
            self.time_view.expand_to_include(time, 0.1);
        }
    }

    /// Update the topic tree from events
    fn update_tree(&mut self, events: &[T]) {
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

    /// Group events by path for efficient lookup
    fn group_events_by_path<'a>(&self, events: &'a [T]) -> HashMap<String, Vec<&'a T>> {
        let mut groups: HashMap<String, Vec<&T>> = HashMap::new();
        for event in events {
            let path = TopicPath::from_event(event.source(), event.event_type());
            groups.entry(path.display()).or_default().push(event);
        }
        groups
    }

    /// Group events by source for efficient lookup
    fn group_events_by_source<'a>(&self, events: &'a [T]) -> HashMap<String, Vec<&'a T>> {
        let mut groups: HashMap<String, Vec<&T>> = HashMap::new();
        for event in events {
            groups.entry(event.source().to_string()).or_default().push(event);
        }
        groups
    }

    /// Render the timeline panel
    pub fn ui(&mut self, ui: &mut Ui, events: &[T]) -> TimelinePanelResponse {
        let mut response = TimelinePanelResponse::default();
        self.hovered_event = None;
        self.update_playback();

        let available_width = ui.available_width();
        let label_width = self.config.label_width;
        let timeline_width = (available_width - label_width).max(100.0);

        // Render controls bar if enabled
        if self.config.show_controls {
            self.render_controls_bar(ui, events, &mut response);
            ui.add_space(self.theme.spacing_xs);
        }

        // Update tree
        self.update_tree(events);

        // Get visible nodes and group events
        let visible_nodes = self.topic_tree.visible_nodes();
        let row_height = self.config.row_height;
        let header_height = self.config.header_height;
        let content_height = visible_nodes.len() as f32 * row_height;

        let events_by_path = self.group_events_by_path(events);
        let events_by_source = self.group_events_by_source(events);

        // Pre-compute node event IDs to avoid borrow issues
        let node_event_data: Vec<(TopicTreeNode, Vec<String>)> = visible_nodes
            .iter()
            .map(|node| {
                let event_ids: Vec<String> = Self::events_for_node_static(node, &events_by_path, &events_by_source)
                    .iter()
                    .map(|e| e.id().to_string())
                    .collect();
                (node.clone(), event_ids)
            })
            .collect();

        // Collect paths that need toggling
        let mut paths_to_toggle: Vec<String> = Vec::new();

        // Main panel
        egui::Frame::none()
            .fill(self.theme.bg_primary)
            .rounding(self.theme.rounding_sm)
            .show(ui, |ui| {
                let (full_rect, _) = ui.allocate_exact_size(
                    Vec2::new(available_width, header_height + content_height),
                    Sense::hover(),
                );
                let painter = ui.painter_at(full_rect);

                // Header row (time axis)
                let header_rect = Rect::from_min_size(full_rect.min, Vec2::new(available_width, header_height));
                self.paint_time_axis(&painter, header_rect, label_width, timeline_width);

                // Content area
                let content_rect = Rect::from_min_max(
                    Pos2::new(full_rect.left(), full_rect.top() + header_height),
                    full_rect.max,
                );

                // Render rows
                let mut y_offset = 0.0;
                for (row_idx, (node, event_ids)) in node_event_data.iter().enumerate() {
                    let row_rect = Rect::from_min_size(
                        Pos2::new(content_rect.left(), content_rect.top() + y_offset),
                        Vec2::new(available_width, row_height),
                    );

                    // Get events for this row
                    let node_events: Vec<&T> = events
                        .iter()
                        .filter(|e| event_ids.contains(&e.id().to_string()))
                        .collect();

                    let (clicked_event, chevron_clicked) = self.render_row(
                        ui,
                        &painter,
                        row_rect,
                        node,
                        row_idx,
                        &node_events,
                        label_width,
                        timeline_width,
                    );

                    if let Some(event_id) = clicked_event {
                        response.selected_event = Some(event_id.clone());
                        self.selected_event = Some(event_id);
                    }

                    if chevron_clicked {
                        paths_to_toggle.push(node.path.display());
                    }

                    y_offset += row_height;
                }

                // Paint playhead
                self.paint_playhead(&painter, content_rect, label_width, timeline_width);

                // Handle pan/zoom interactions
                self.handle_interactions(ui, content_rect, label_width, timeline_width, &mut response);
            });

        // Apply toggled paths after the closure
        for path in paths_to_toggle {
            self.toggle_collapsed(&path);
        }

        response
    }

    fn render_controls_bar(&mut self, ui: &mut Ui, events: &[T], response: &mut TimelinePanelResponse) {
        ui.horizontal(|ui| {
            // Playback controls
            let play_text = match self.playback_state {
                PlaybackState::Following => "⏸ Pause",
                PlaybackState::Playing => "⏸ Pause",
                PlaybackState::Paused => "▶ Play",
            };

            if ui.button(play_text).clicked() {
                self.playback_state = match self.playback_state {
                    PlaybackState::Following | PlaybackState::Playing => PlaybackState::Paused,
                    PlaybackState::Paused => PlaybackState::Playing,
                };
                response.playhead_changed = true;
            }

            let live_text = if self.playback_state == PlaybackState::Following {
                "🔴 LIVE"
            } else {
                "◯ Live"
            };

            if ui.button(live_text).clicked() {
                self.playback_state = if self.playback_state == PlaybackState::Following {
                    PlaybackState::Paused
                } else {
                    PlaybackState::Following
                };
                response.playhead_changed = true;
            }

            ui.separator();

            // Fit to data
            if ui.button("⊡ Fit").clicked() {
                self.fit_to_events(events);
                response.range_changed = true;
            }

            ui.separator();

            // Time display
            ui.label(
                RichText::new(format!("{}", self.playhead.format("%Y-%m-%d %H:%M:%S")))
                    .color(self.theme.text_secondary)
                    .font(self.theme.font_mono_small.clone()),
            );
        });
    }

    fn paint_time_axis(
        &self,
        painter: &egui::Painter,
        rect: Rect,
        label_width: f32,
        timeline_width: f32,
    ) {
        painter.rect_filled(rect, self.theme.rounding_none, self.theme.bg_elevated);

        let timeline_rect = Rect::from_min_size(
            Pos2::new(rect.left() + label_width, rect.top()),
            Vec2::new(timeline_width, rect.height()),
        );

        // Draw time markers
        let duration = self.time_view.duration();
        let interval = self.calculate_tick_interval(duration.num_seconds());
        let start_time = self.time_view.start();
        let end_time = self.time_view.end();

        // Align to interval
        let aligned_start = (start_time.timestamp() / interval) * interval;
        let mut tick_time = DateTime::<Utc>::from_timestamp(aligned_start, 0).unwrap_or(start_time);

        while tick_time <= end_time {
            let x = self.time_view.time_to_x(tick_time, timeline_width) + timeline_rect.left();
            if x >= timeline_rect.left() && x <= timeline_rect.right() {
                // Tick line
                painter.vline(x, rect.y_range(), Stroke::new(1.0, self.theme.separator));

                // Label
                let label = self.timezone.format_time(tick_time);
                painter.text(
                    Pos2::new(x + 4.0, rect.center().y),
                    Align2::LEFT_CENTER,
                    label,
                    self.theme.font_mono_small.clone(),
                    self.theme.text_muted,
                );
            }

            tick_time = DateTime::from_timestamp(tick_time.timestamp() + interval, 0)
                .unwrap_or(tick_time + Duration::seconds(interval));
        }
    }

    fn calculate_tick_interval(&self, duration_secs: i64) -> i64 {
        if duration_secs < 60 {
            10 // 10 seconds
        } else if duration_secs < 300 {
            30 // 30 seconds
        } else if duration_secs < 3600 {
            300 // 5 minutes
        } else if duration_secs < 86400 {
            3600 // 1 hour
        } else {
            86400 // 1 day
        }
    }

    fn paint_playhead(
        &self,
        painter: &egui::Painter,
        rect: Rect,
        label_width: f32,
        timeline_width: f32,
    ) {
        let x = self.time_view.time_to_x(self.playhead, timeline_width) + rect.left() + label_width;
        if x >= rect.left() + label_width && x <= rect.right() {
            painter.vline(x, rect.y_range(), Stroke::new(2.0, self.theme.playhead));

            // Playhead handle
            let handle_rect = Rect::from_center_size(Pos2::new(x, rect.top()), Vec2::new(12.0, 8.0));
            painter.rect_filled(handle_rect, self.theme.rounding_sm, self.theme.playhead);
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn render_row(
        &mut self,
        ui: &mut Ui,
        painter: &egui::Painter,
        rect: Rect,
        node: &TopicTreeNode,
        row_idx: usize,
        events: &[&T],
        label_width: f32,
        timeline_width: f32,
    ) -> (Option<String>, bool) {
        let mut clicked_event_id = None;
        let mut chevron_clicked = false;
        let depth = node.path.depth().saturating_sub(1);

        let row_id = egui::Id::new("timeline_row").with(row_idx).with(&node.name);
        let row_response = ui.interact(rect, row_id, Sense::click());

        let is_hovered = row_response.hovered();
        let is_selected = self
            .selected_event
            .as_ref()
            .map(|id| events.iter().any(|e| e.id() == id))
            .unwrap_or(false);

        // Background
        let bg_color = if is_selected {
            self.theme.bg_row_selected
        } else if is_hovered {
            self.theme.bg_row_hover
        } else if row_idx.is_multiple_of(2) {
            self.theme.bg_primary
        } else {
            self.theme.bg_row_alt
        };
        painter.rect_filled(rect, self.theme.rounding_none, bg_color);

        // Separator lines
        painter.hline(rect.x_range(), rect.bottom(), Stroke::new(1.0, self.theme.separator));
        painter.vline(rect.left() + label_width, rect.y_range(), Stroke::new(1.0, self.theme.separator));

        // Indent guide
        if depth > 0 {
            let guide_x = rect.left() + self.theme.spacing_sm + (depth as f32 - 1.0) * self.config.indent_size + 4.0;
            painter.vline(guide_x, rect.y_range(), Stroke::new(1.0, self.theme.indent_guide));
        }

        // Chevron for expandable nodes
        let indent = self.theme.spacing_sm + depth as f32 * self.config.indent_size;
        let chevron_size = 10.0;

        if !node.children.is_empty() {
            let chevron_center = Pos2::new(rect.left() + indent + chevron_size / 2.0, rect.center().y);
            let chevron_text = if node.expanded { "▾" } else { "▸" };
            painter.text(
                chevron_center,
                Align2::CENTER_CENTER,
                chevron_text,
                self.theme.font_small.clone(),
                self.theme.chevron,
            );

            let chevron_rect = Rect::from_center_size(chevron_center, Vec2::splat(chevron_size + 4.0));
            let chevron_id = egui::Id::new("timeline_chevron").with(row_idx).with(&node.name);
            let chevron_response = ui.interact(chevron_rect, chevron_id, Sense::click());
            if chevron_response.clicked() {
                chevron_clicked = true;
            }
        }

        // Icon and label
        let icon_x = rect.left() + indent + chevron_size + self.theme.spacing_xs;
        let icon = if node.path.depth() == 1 {
            "🔷"
        } else if !node.children.is_empty() {
            "📁"
        } else {
            "📄"
        };

        // Color indicator
        let color_rect = Rect::from_min_size(
            Pos2::new(icon_x, rect.center().y - 4.0),
            Vec2::new(3.0, 8.0),
        );
        painter.rect_filled(color_rect, self.theme.rounding_none, node.color);

        // Name label
        let name_label = if !node.children.is_empty() && node.expanded {
            format!("{}/", node.name)
        } else {
            node.name.clone()
        };
        painter.text(
            Pos2::new(color_rect.right() + self.theme.spacing_xs, rect.center().y),
            Align2::LEFT_CENTER,
            format!("{} {}", icon, name_label),
            self.theme.font_small.clone(),
            if is_hovered { self.theme.text_primary } else { self.theme.text_secondary },
        );

        // Event markers in timeline area
        let timeline_rect = Rect::from_min_size(
            Pos2::new(rect.left() + label_width, rect.top()),
            Vec2::new(timeline_width, rect.height()),
        );

        for event in events {
            let x = self.time_view.time_to_x(event.occurred_at(), timeline_width) + timeline_rect.left();
            if x >= timeline_rect.left() && x <= timeline_rect.right() {
                let marker_rect = Rect::from_center_size(
                    Pos2::new(x, rect.center().y),
                    Vec2::new(6.0, rect.height() * 0.6),
                );

                let ui_event_id = egui::Id::new("timeline_event").with(event.id());
                let event_response = ui.interact(marker_rect, ui_event_id, Sense::click());

                let marker_color = if self.selected_event.as_ref() == Some(&event.id().to_string()) {
                    self.theme.accent
                } else if event_response.hovered() {
                    self.hovered_event = Some(event.id().to_string());
                    self.theme.accent_hover
                } else {
                    event.color().unwrap_or_else(|| source_color(event.source()))
                };

                painter.rect_filled(marker_rect, self.theme.rounding_sm, marker_color);

                if event_response.clicked() {
                    clicked_event_id = Some(event.id().to_string());
                }
            }
        }

        (clicked_event_id, chevron_clicked)
    }

    fn handle_interactions(
        &mut self,
        ui: &mut Ui,
        rect: Rect,
        label_width: f32,
        timeline_width: f32,
        response: &mut TimelinePanelResponse,
    ) {
        let timeline_rect = Rect::from_min_size(
            Pos2::new(rect.left() + label_width, rect.top()),
            Vec2::new(timeline_width, rect.height()),
        );

        let interact_id = egui::Id::new("timeline_interact");
        let interact_response = ui.interact(timeline_rect, interact_id, Sense::click_and_drag());

        // Pan with drag
        if interact_response.dragged() {
            let delta = interact_response.drag_delta();
            let ms_per_pixel = self.time_view.duration().num_milliseconds() as f32 / timeline_width;
            self.time_view.pan((-delta.x * ms_per_pixel) as i64);
            self.is_panning = true;
            response.range_changed = true;
        }

        if interact_response.drag_stopped() {
            self.is_panning = false;
        }

        // Click to set playhead
        if interact_response.clicked() && !self.is_panning {
            if let Some(pos) = interact_response.interact_pointer_pos() {
                let x = pos.x - timeline_rect.left();
                self.playhead = self.time_view.x_to_time(x, timeline_width);
                self.playback_state = PlaybackState::Paused;
                response.playhead_changed = true;
            }
        }

        // Scroll to zoom
        let scroll = ui.input(|i| i.raw_scroll_delta);
        if scroll.y.abs() > 0.1 && interact_response.hovered() {
            if let Some(pos) = ui.input(|i| i.pointer.hover_pos()) {
                if timeline_rect.contains(pos) {
                    let x = pos.x - timeline_rect.left();
                    let anchor_time = self.time_view.x_to_time(x, timeline_width);
                    let zoom_factor = if scroll.y > 0.0 { 1.1 } else { 0.9 };
                    self.time_view.zoom_at(anchor_time, zoom_factor);
                    response.range_changed = true;
                }
            }
        }

        // Pinch to zoom
        let zoom = ui.input(|i| i.zoom_delta());
        if zoom != 1.0 {
            if let Some(pos) = ui.input(|i| i.pointer.hover_pos()) {
                if timeline_rect.contains(pos) {
                    let x = pos.x - timeline_rect.left();
                    let anchor_time = self.time_view.x_to_time(x, timeline_width);
                    self.time_view.zoom_at(anchor_time, zoom);
                    response.range_changed = true;
                }
            }
        }
    }

    fn events_for_node_static<'a>(
        node: &TopicTreeNode,
        events_by_path: &'a HashMap<String, Vec<&'a T>>,
        events_by_source: &'a HashMap<String, Vec<&'a T>>,
    ) -> Vec<&'a T> {
        if node.path.depth() == 1 {
            events_by_source.get(&node.name).cloned().unwrap_or_default()
        } else if node.children.is_empty() {
            events_by_path.get(&node.path.display()).cloned().unwrap_or_default()
        } else {
            let mut result = Vec::new();
            Self::collect_events_recursive(node, events_by_path, &mut result);
            result
        }
    }

    fn collect_events_recursive<'a>(
        node: &TopicTreeNode,
        events_by_path: &'a HashMap<String, Vec<&'a T>>,
        result: &mut Vec<&'a T>,
    ) {
        if let Some(events) = events_by_path.get(&node.path.display()) {
            result.extend(events.iter());
        }
        for child in &node.children {
            Self::collect_events_recursive(child, events_by_path, result);
        }
    }
}

impl<T: TimelineEventData> Default for TimelinePanel<T> {
    fn default() -> Self {
        Self::new()
    }
}
