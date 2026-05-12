/*
 * Stream Timeline — topic-tree builder.
 *
 * Turns a flat list of events into a `source/type/...` tree so the
 * viewer can render one row per topic. Pure helpers only; React and
 * the viewer split out the visible rows via `getVisibleNodes()` once
 * collapse state is known.
 */

import type { StreamTimelineEvent } from "./types";
import { sourceColor, pathColor } from "./source-color";

export interface TopicPath {
  segments: string[];
}

export function topicPathFromEvent(
  source: string,
  eventType: string,
): TopicPath {
  const typePart =
    eventType
      .replace(new RegExp(`^${source}\\.`), "")
      .replace(new RegExp(`^${source}_`), "") || eventType;
  const segments = [source, ...typePart.split(".")];
  return { segments };
}

export function topicPathDisplay(path: TopicPath): string {
  return path.segments.join("/");
}

export function topicPathLeaf(path: TopicPath): string {
  return path.segments[path.segments.length - 1] ?? "";
}

export interface TopicTreeNode {
  path: TopicPath;
  /** Last segment of the path (e.g. `created`). */
  name: string;
  /** Display key (`source/sub/leaf`). */
  pathKey: string;
  expanded: boolean;
  children: TopicTreeNode[];
  eventCount: number;
  /** Resolved color (CSS var or hsl string). */
  color: string;
  /** Depth from the root. 1 = source row, 2+ = sub-paths. */
  depth: number;
}

export function buildTopicTree(
  events: readonly StreamTimelineEvent[],
): TopicTreeNode[] {
  const leafCounts: Record<string, number> = {};
  for (const e of events) {
    const path = topicPathFromEvent(e.source, e.type);
    const key = topicPathDisplay(path);
    leafCounts[key] = (leafCounts[key] ?? 0) + 1;
  }

  const rootMap: Record<string, TopicTreeNode> = {};

  for (const e of events) {
    const path = topicPathFromEvent(e.source, e.type);
    if (path.segments.length === 0) continue;
    const source = path.segments[0]!;
    const baseColor = sourceColor(source);
    const color =
      path.segments.length === 1
        ? baseColor
        : pathColor(topicPathDisplay(path), baseColor);

    const rootKey = source;
    let root = rootMap[rootKey];
    if (!root) {
      root = {
        path: { segments: [source] },
        name: source,
        pathKey: source,
        expanded: true,
        children: [],
        eventCount: path.segments.length === 1 ? leafCounts[source] ?? 0 : 0,
        color: baseColor,
        depth: 1,
      };
      rootMap[rootKey] = root;
    }

    if (path.segments.length > 1) {
      insertPath(root, path, 1, leafCounts, baseColor, color);
    }
  }

  const roots = Object.values(rootMap).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const r of roots) sortChildren(r);
  return roots;
}

function insertPath(
  node: TopicTreeNode,
  fullPath: TopicPath,
  segmentIdx: number,
  leafCounts: Record<string, number>,
  baseColor: string,
  leafColor: string,
): void {
  if (segmentIdx >= fullPath.segments.length) return;
  const partial: TopicPath = {
    segments: fullPath.segments.slice(0, segmentIdx + 1),
  };
  const key = topicPathDisplay(partial);
  const name = topicPathLeaf(partial);
  const isLeaf = segmentIdx === fullPath.segments.length - 1;
  let child = node.children.find((c) => c.pathKey === key);
  if (!child) {
    child = {
      path: partial,
      name,
      pathKey: key,
      expanded: true,
      children: [],
      eventCount: isLeaf ? leafCounts[key] ?? 0 : 0,
      color: isLeaf ? leafColor : pathColor(key, baseColor),
      depth: segmentIdx + 1,
    };
    node.children.push(child);
  }
  if (segmentIdx + 1 < fullPath.segments.length) {
    insertPath(child, fullPath, segmentIdx + 1, leafCounts, baseColor, leafColor);
  }
}

function sortChildren(node: TopicTreeNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name));
  node.children.forEach(sortChildren);
}

/** Flatten visible (uncollapsed) nodes for row rendering. */
export function getVisibleNodes(
  roots: readonly TopicTreeNode[],
  collapsedSet: ReadonlySet<string>,
): TopicTreeNode[] {
  const out: TopicTreeNode[] = [];
  function walk(n: TopicTreeNode) {
    out.push(n);
    const isCollapsed = collapsedSet.has(n.pathKey);
    if (!isCollapsed) for (const c of n.children) walk(c);
  }
  for (const r of roots) walk(r);
  return out;
}
