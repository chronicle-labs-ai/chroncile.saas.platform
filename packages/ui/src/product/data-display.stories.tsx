import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../primitives/button";
import { EmptyState } from "../primitives/empty-state";
import {
  ActionBar,
  Carousel,
  DataGrid,
  FileTree,
  FloatingToc,
  HoverCard,
  ItemCard,
  ItemCardGroup,
  KPI,
  KPIGroup,
  Kanban,
  ListView,
  Widget,
  type DataGridColumn,
  type FileTreeNode,
} from "./data-display";

const meta: Meta = {
  title: "Product/Data Display",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

const payments = [
  {
    id: "pay_001",
    customer: "Acme Robotics",
    amount: 4200,
    status: "succeeded",
    risk: "low",
  },
  {
    id: "pay_002",
    customer: "Northstar Labs",
    amount: 1180,
    status: "pending",
    risk: "medium",
  },
  {
    id: "pay_003",
    customer: "Atlas Cloud",
    amount: 860,
    status: "failed",
    risk: "high",
  },
];

const paymentColumns: DataGridColumn<(typeof payments)[number]>[] = [
  {
    id: "customer",
    header: "Customer",
    accessorKey: "customer",
    allowsSorting: true,
  },
  {
    id: "amount",
    header: "Amount",
    accessorKey: "amount",
    align: "end",
    allowsSorting: true,
    cell: (item) => `$${item.amount.toLocaleString()}`,
  },
  {
    id: "status",
    header: "Status",
    cell: (item) => (
      <span className="inline-flex items-center gap-s-2">
        <span
          className="h-2 w-2 rounded-pill"
          style={{
            background:
              item.status === "failed"
                ? "var(--c-event-red)"
                : item.status === "pending"
                  ? "var(--c-event-amber)"
                  : "var(--c-event-green)",
          }}
        />
        {item.status}
      </span>
    ),
  },
  { id: "risk", header: "Risk", accessorKey: "risk" },
];

const files: FileTreeNode[] = [
  {
    id: "app",
    title: "app",
    children: [
      { id: "app/page", title: "page.tsx" },
      { id: "app/layout", title: "layout.tsx" },
    ],
  },
  {
    id: "packages",
    title: "packages",
    children: [
      {
        id: "packages/ui",
        title: "ui",
        children: [
          { id: "packages/ui/data-display", title: "data-display.tsx" },
        ],
      },
    ],
  },
];

const tocItems = [
  { id: "overview", label: "Overview", level: 1 },
  { id: "metrics", label: "Metrics", level: 1 },
  { id: "traces", label: "Trace details", level: 2 },
  { id: "exports", label: "Exports", level: 1 },
];

const kanbanColumns: Array<[string, string[]]> = [
  ["Backlog", ["Add command palette", "Review Pro data-grid API"]],
  ["In progress", ["Adapt KPI cards"]],
  ["Done", ["Map data display inventory"]],
];

export const ActionBarExample: Story = {
  render: () => (
    <div className="relative h-[220px] rounded-md border border-hairline-strong bg-l-surface p-s-6">
      <p className="text-sm text-l-ink-dim">
        Select rows in a grid to reveal contextual actions.
      </p>
      <ActionBar isOpen>
        <ActionBar.Prefix>
          <span className="rounded-pill bg-l-wash-3 px-s-2 py-1 text-xs">
            3 selected
          </span>
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button size="sm" variant="ghost">
            Export
          </Button>
          <Button size="sm" variant="ghost">
            Archive
          </Button>
          <Button size="sm" variant="critical">
            Delete
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Button size="sm" variant="ghost">
            Clear
          </Button>
        </ActionBar.Suffix>
      </ActionBar>
    </div>
  ),
};

export const CarouselExample: Story = {
  render: () => (
    <div className="max-w-[640px]">
      <Carousel>
        <Carousel.Content>
          {["Replay timeline", "Trace inspector", "Metric rollup"].map(
            (title, index) => (
              <Carousel.Item key={title}>
                <div className="flex h-[220px] items-end rounded-lg border border-hairline-strong bg-l-surface-raised p-s-5">
                  <div>
                    <div className="text-xs uppercase tracking-eyebrow text-l-ink-dim">
                      Slide {index + 1}
                    </div>
                    <div className="mt-s-1 text-xl font-semibold text-l-ink">
                      {title}
                    </div>
                  </div>
                </div>
              </Carousel.Item>
            )
          )}
        </Carousel.Content>
        <Carousel.Previous aria-label="Previous slide" />
        <Carousel.Next aria-label="Next slide" />
        <Carousel.Dots />
      </Carousel>
    </div>
  ),
};

export const DataGridExample: Story = {
  render: () => (
    <DataGrid
      aria-label="Payments"
      columns={paymentColumns}
      data={payments}
      getRowId={(item) => item.id}
      selectionMode="multiple"
      defaultSortDescriptor={{ column: "customer", direction: "ascending" }}
    />
  ),
};

export const EmptyStateExample: Story = {
  render: () => (
    <EmptyState size="lg" chrome="outline">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <span className="text-lg">∅</span>
        </EmptyState.Media>
        <EmptyState.Title>No traces match this filter</EmptyState.Title>
        <EmptyState.Description>
          Try removing a source or status filter to broaden the result set.
        </EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button variant="ghost">Reset filters</Button>
        <Button variant="primary">Create trace</Button>
      </EmptyState.Content>
    </EmptyState>
  ),
};

export const FileTreeExample: Story = {
  render: () => (
    <div className="max-w-[420px]">
      <FileTree
        items={files}
        defaultExpandedKeys={["app", "packages", "packages/ui"]}
      />
    </div>
  ),
};

export const FloatingTocExample: Story = {
  render: () => (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-hairline-strong bg-l-surface">
      <FloatingToc items={tocItems} activeId="traces" />
    </div>
  ),
};

export const HoverCardExample: Story = {
  render: () => (
    <div className="flex h-[220px] items-center justify-center">
      <HoverCard defaultOpen>
        <HoverCard.Trigger>
          <button className="rounded-md bg-l-wash-3 px-s-3 py-s-2 text-l-ink">
            Northstar Labs
          </button>
        </HoverCard.Trigger>
        <HoverCard.Content placement="top">
          <HoverCard.Arrow />
          <div className="text-sm font-medium text-l-ink">Northstar Labs</div>
          <p className="mt-s-1 text-sm text-l-ink-dim">
            32 active traces, 4 failed runs this week.
          </p>
        </HoverCard.Content>
      </HoverCard>
    </div>
  ),
};

export const ItemCardsExample: Story = {
  render: () => (
    <ItemCardGroup layout="grid" columns={2}>
      <ItemCardGroup.Header className="col-span-full">
        <ItemCardGroup.Title>Connected systems</ItemCardGroup.Title>
        <ItemCardGroup.Description>
          Data sources available to the replay engine.
        </ItemCardGroup.Description>
      </ItemCardGroup.Header>
      {["Stripe", "Nango", "Gorgias", "Shopify"].map((name) => (
        <ItemCard key={name}>
          <ItemCard.Icon>{name.slice(0, 1)}</ItemCard.Icon>
          <ItemCard.Content>
            <ItemCard.Title>{name}</ItemCard.Title>
            <ItemCard.Description>
              Healthy sync · 2 min ago
            </ItemCard.Description>
          </ItemCard.Content>
          <ItemCard.Action>
            <span className="inline-flex items-center gap-s-2 text-xs text-l-ink-dim">
              <span className="h-2 w-2 rounded-pill bg-event-green" />
              Live
            </span>
          </ItemCard.Action>
        </ItemCard>
      ))}
    </ItemCardGroup>
  ),
};

export const KPIExample: Story = {
  render: () => (
    <KPIGroup>
      <KPI>
        <KPI.Header>
          <KPI.Icon status="success">↗</KPI.Icon>
          <div>
            <KPI.Title>Resolved runs</KPI.Title>
            <KPI.Footer>Last 7 days</KPI.Footer>
          </div>
        </KPI.Header>
        <KPI.Content>
          <KPI.Value value={1284} />
          <KPI.Trend status="success">+12.4%</KPI.Trend>
          <KPI.Chart
            data={[
              { value: 20 },
              { value: 42 },
              { value: 38 },
              { value: 61 },
              { value: 72 },
            ]}
          />
        </KPI.Content>
      </KPI>
      <KPI>
        <KPI.Header>
          <KPI.Icon status="warning">!</KPI.Icon>
          <div>
            <KPI.Title>Open incidents</KPI.Title>
            <KPI.Footer>Needs triage</KPI.Footer>
          </div>
        </KPI.Header>
        <KPI.Content>
          <KPI.Value value={18} />
          <KPI.Trend status="warning">+3</KPI.Trend>
          <KPI.Progress value={62} status="warning" />
        </KPI.Content>
      </KPI>
    </KPIGroup>
  ),
};

export const ListViewExample: Story = {
  render: () => (
    <ListView
      aria-label="Files"
      items={payments}
      getItemId={(item) => item.id}
      selectionMode="multiple"
    >
      {(item) => (
        <>
          <ListView.ItemContent>
            <div className="h-8 w-8 rounded-md bg-l-wash-3" />
            <div>
              <ListView.Title>{item.customer}</ListView.Title>
              <ListView.Description>
                {item.status} · ${item.amount}
              </ListView.Description>
            </div>
          </ListView.ItemContent>
          <ListView.ItemAction>
            <Button size="sm" variant="ghost">
              Open
            </Button>
          </ListView.ItemAction>
        </>
      )}
    </ListView>
  ),
};

export const KanbanExample: Story = {
  render: () => (
    <Kanban>
      {kanbanColumns.map(([title, cards]) => (
        <Kanban.Column key={title}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnIndicator />
            <Kanban.ColumnTitle>{title}</Kanban.ColumnTitle>
            <Kanban.ColumnCount>{cards.length}</Kanban.ColumnCount>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList>
              {cards.map((card) => (
                <Kanban.Card key={card}>{card}</Kanban.Card>
              ))}
            </Kanban.CardList>
          </Kanban.ColumnBody>
        </Kanban.Column>
      ))}
    </Kanban>
  ),
};

export const WidgetExample: Story = {
  render: () => (
    <Widget>
      <Widget.Header>
        <div>
          <Widget.Title>Replay quality</Widget.Title>
          <Widget.Description>
            Grouped by outcome across the current workspace.
          </Widget.Description>
        </div>
        <Widget.Legend>
          <Widget.LegendItem color="var(--c-event-green)">
            Pass
          </Widget.LegendItem>
          <Widget.LegendItem color="var(--c-event-red)">Fail</Widget.LegendItem>
        </Widget.Legend>
      </Widget.Header>
      <Widget.Content>
        <DataGrid
          aria-label="Replay quality"
          columns={paymentColumns.slice(0, 3)}
          data={payments}
          getRowId={(item) => item.id}
        />
      </Widget.Content>
      <Widget.Footer>Updated 4 minutes ago.</Widget.Footer>
    </Widget>
  ),
};
