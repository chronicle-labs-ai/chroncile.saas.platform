import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import {
  ConnectionRow,
  CONNECTION_ROW_GRID_TEMPLATE,
} from "./connection-row";
import { connectionsSeed } from "./data";

const Header = () => (
  <div
    className={`grid items-center gap-3 px-3 pb-2 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim ${CONNECTION_ROW_GRID_TEMPLATE}`}
  >
    <span />
    <span>Connection</span>
    <span>Health</span>
    <span>Volume</span>
    <span>Trend</span>
    <span>Scopes</span>
    <span />
  </div>
);

const meta: Meta<typeof ConnectionRow> = {
  title: "Connections/ConnectionRow",
  component: ConnectionRow,
  parameters: { layout: "fullscreen" },
  args: {
    connection: connectionsSeed[0],
    isActive: false,
    hideId: false,
    onOpen: fn(),
    onPause: fn(),
    onResume: fn(),
    onReauth: fn(),
    onTest: fn(),
    onSettings: fn(),
    onDisconnect: fn(),
  },
  argTypes: {
    isActive: { control: "boolean" },
    hideId: { control: "boolean" },
    connection: { control: false },
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionRow>;

/**
 * Playground — single row driven by the Controls panel. Tweak
 * `isActive` to preview the master/detail focus tone, and `hideId` to
 * see the cleaner production-density subtitle.
 */
export const Playground: Story = {
  render: (args) => (
    <div className="bg-page p-6">
      <Header />
      <ConnectionRow {...args} />
    </div>
  ),
};

/**
 * All states — one row per connection in the seed. Visual sweep of the
 * full health palette: live, paused, error, expired, testing,
 * disconnected. Each row's onOpen handler fires through Storybook's
 * Actions panel via `fn()`.
 */
export const AllStates: Story = {
  render: (args) => (
    <div className="bg-page p-6">
      <Header />
      <div className="flex flex-col gap-2">
        {connectionsSeed.map((c) => (
          <ConnectionRow {...args} key={c.id} connection={c} />
        ))}
      </div>
    </div>
  ),
};

/**
 * Active — middle row in the master/detail tone, surrounding rows in
 * the default tone. Use this to confirm the active border + wash never
 * bleed onto a focused or hovered neighbour.
 */
export const Active: Story = {
  render: (args) => (
    <div className="bg-page p-6">
      <Header />
      <div className="flex flex-col gap-2">
        {connectionsSeed.slice(0, 3).map((c, i) => (
          <ConnectionRow
            {...args}
            key={c.id}
            connection={c}
            isActive={i === 1}
          />
        ))}
      </div>
    </div>
  ),
};

/**
 * Without id — same data, `hideId` toggled on. The subtitle drops the
 * connection id so the category + auth pair no longer truncates on
 * narrow viewports. Closer to the production density.
 */
export const WithoutId: Story = {
  render: (args) => (
    <div className="bg-page p-6">
      <Header />
      <div className="flex flex-col gap-2">
        {connectionsSeed.slice(0, 5).map((c) => (
          <ConnectionRow {...args} key={c.id} connection={c} hideId />
        ))}
      </div>
    </div>
  ),
};

/**
 * Minimal — a single row with no callbacks wired. The action menu and
 * the stretched-link overlay both go away — useful for read-only
 * surfaces (audit log entries, share previews).
 */
export const Minimal: Story = {
  render: () => (
    <div className="bg-page p-6">
      <ConnectionRow connection={connectionsSeed[0]!} />
    </div>
  ),
};
