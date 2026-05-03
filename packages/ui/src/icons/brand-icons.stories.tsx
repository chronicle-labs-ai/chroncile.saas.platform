import type { Meta, StoryObj } from "@storybook/react";
import {
  BrandIcon,
  BRAND_ICON_DOMAINS,
  BRAND_ICON_IDS,
  CompanyLogo,
  MONOCHROME_DARK_MARK_BRANDS,
  getLogoDevUrl,
} from "./brand-icons";

const STORYBOOK_LOGO_DEV_TOKEN = "pk_KUdn1PMmSYCZmOzzW8W04A";

const meta: Meta<typeof BrandIcon> = {
  title: "Icons/BrandIcon",
  component: BrandIcon,
  parameters: { layout: "padded" },
  argTypes: {
    id: { control: "select", options: BRAND_ICON_IDS },
    radius: { control: "text" },
    requestSize: { control: { type: "number", min: 16, max: 512 } },
    rounded: { control: "boolean" },
    size: { control: { type: "number", min: 12, max: 96 } },
    token: { control: "text" },
  },
  args: {
    fallbackColor: "var(--c-ink-hi)",
    id: "slack",
    requestSize: 128,
    rounded: true,
    size: 32,
    token: STORYBOOK_LOGO_DEV_TOKEN,
  },
};
export default meta;
type Story = StoryObj<typeof BrandIcon>;

export const Default: Story = {
  render: (args) => <BrandIcon {...args} />,
};

export const FallbackProof: Story = {
  render: () => (
    <div className="flex items-center gap-s-3 rounded-sm border border-hairline bg-surface-01 p-s-4 text-ink-hi">
      <BrandIcon
        id="intercom"
        size={48}
        rounded
        fallbackColor="var(--c-ink-hi)"
        fallbackBackground="var(--c-surface-03)"
      />
      <span className="font-sans text-label-sm">
        BrandIcon fallback rendered without a Logo.dev token.
      </span>
    </div>
  ),
};

export const Catalog: Story = {
  args: {
    size: 3000,
    format: "png",
    radius: "35",
  },

  render: (args) => (
    <div className="grid grid-cols-4 gap-s-4">
      {BRAND_ICON_IDS.map((id) => (
        <div
          key={id}
          className="flex flex-col items-center gap-s-2 rounded-sm border border-hairline bg-surface-01 p-s-4"
        >
          <BrandIcon
            {...args}
            id={id}
            rounded={args.rounded}
            radius={args.radius}
            size={32}
            fallbackColor="var(--c-ink-hi)"
            token={STORYBOOK_LOGO_DEV_TOKEN}
          />
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            {id}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const RoundedVariants: Story = {
  args: {
    size: 100,
  },

  render: (args) => (
    <div className="flex items-center gap-s-4 rounded-sm border border-hairline bg-surface-01 p-s-4">
      <BrandIcon {...args} id="intercom" rounded={false} radius={0} size={48} />
      <BrandIcon {...args} id="slack" radius={12} size={48} />
      <BrandIcon {...args} id="snowflake" rounded size={48} />
    </div>
  ),
};

/*
 * DarkMarkInversion — proves that monochrome-dark brand marks
 * (GitHub, Vercel, OpenAI, …) stay readable in dark theme by
 * flipping black → white via the global CSS rule, while leaving
 * multi-color logos untouched. Toggle the Storybook theme to see
 * the inversion engage / disengage.
 *
 * The `themeAware={false}` row shows the un-patched render — what
 * every connection card / row used to look like in dark mode:
 * black mark on near-black surface, just a faint hairline outline.
 */
export const DarkMarkInversion: Story = {
  parameters: { layout: "padded" },
  render: () => {
    const samples = [
      "github",
      "openai",
      "vercel",
      "cursor",
      "anthropic",
      "x",
      "notion",
      // Multi-color — should NOT invert. Negative control.
      "slack",
      "stripe",
      "intercom",
    ];

    const Cell = ({
      label,
      children,
    }: {
      label: string;
      children: React.ReactNode;
    }) => (
      <div className="flex flex-col items-center gap-s-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-sm border border-hairline bg-surface-02"
          aria-hidden
        >
          {children}
        </span>
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          {label}
        </span>
      </div>
    );

    return (
      <div className="flex flex-col gap-s-6 rounded-sm border border-hairline bg-surface-01 p-s-5">
        <div>
          <p className="mb-s-3 font-sans text-label-sm text-ink-hi">
            Default — auto-invert on dark theme
          </p>
          <div className="grid grid-cols-5 gap-s-4">
            {samples.map((name) => (
              <Cell key={`on-${name}`} label={name}>
                <CompanyLogo name={name} size={20} radius={3} />
              </Cell>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-s-3 font-sans text-label-sm text-ink-hi">
            <code className="font-mono text-[12px]">themeAware=&#123;false&#125;</code>{" "}
            — pre-patch render
          </p>
          <div className="grid grid-cols-5 gap-s-4">
            {samples.map((name) => (
              <Cell key={`off-${name}`} label={name}>
                <CompanyLogo
                  name={name}
                  size={20}
                  radius={3}
                  themeAware={false}
                />
              </Cell>
            ))}
          </div>
        </div>

        <p className="font-mono text-mono-sm text-ink-dim">
          Curated allowlist:{" "}
          {[...MONOCHROME_DARK_MARK_BRANDS].sort().join(", ")}
        </p>
      </div>
    );
  },
};

export const LogoDevUrls: Story = {
  render: () => (
    <div className="space-y-s-2 font-mono text-mono-sm text-ink-dim">
      {BRAND_ICON_IDS.slice(0, 6).map((id) => (
        <div key={id}>
          {getLogoDevUrl(BRAND_ICON_DOMAINS[id], {
            requestSize: 128,
            token: STORYBOOK_LOGO_DEV_TOKEN,
          })}
        </div>
      ))}
    </div>
  ),
};
