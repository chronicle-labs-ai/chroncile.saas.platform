"use client";

/*
 * WorkspaceSwitcher — fully split compound API with a shared context
 * (HeroUI pattern), plus a batteries-included default layout that
 * renders automatically when no children are provided.
 *
 * Two ways to use it:
 *
 *   // 1. Batteries-included (80% of callers)
 *   <WorkspaceSwitcher
 *     current={current}
 *     workspaces={workspaces}
 *     onSelect={setWorkspace}
 *     onCreate={() => ...}
 *     onManage={() => ...}
 *   />
 *
 *   // 2. Fully composed (when you need to rearrange or inject)
 *   <WorkspaceSwitcher current={current} workspaces={workspaces} onSelect={setWorkspace}>
 *     <WorkspaceSwitcher.Trigger />
 *     <WorkspaceSwitcher.Popover>
 *       <WorkspaceSwitcher.Search />
 *       <WorkspaceSwitcher.List />
 *       <WorkspaceSwitcher.Footer>
 *         <WorkspaceSwitcher.Action icon={<Plus />} onClick={handleCreate}>
 *           Create workspace
 *         </WorkspaceSwitcher.Action>
 *       </WorkspaceSwitcher.Footer>
 *     </WorkspaceSwitcher.Popover>
 *   </WorkspaceSwitcher>
 *
 * Context carries the data + tv() slots + open state + search query so
 * any sub-component can render from anywhere in the tree without prop
 * drilling.
 */

import * as React from "react";

import { tv } from "../utils/tv";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  deriveInitials,
  type AvatarTone,
} from "../primitives/avatar";

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

/**
 * One row in the workspace switcher dropdown. Renamed from `Workspace`
 * so the simpler `Workspace` name can live in `auth/` (where it
 * describes a workspace membership in the picker page). The package
 * barrel re-exports both `layout` and `auth`, so the names cannot
 * collide.
 */
export interface WorkspaceSwitcherEntry {
  id: string;
  name: string;
  /** Free-form plan label (e.g. "Pro", "Free", "Enterprise"). */
  plan?: string;
  /** Avatar image URL. Falls back to initials derived from `name`. */
  avatarUrl?: string | null;
  /** Override initials (otherwise first + last initial). */
  initials?: string;
  /** Avatar tint. Defaults to `neutral`. Mirrors the full
   *  `AvatarTone` palette so workspace tints match the Label hues. */
  avatarTone?: AvatarTone;
  /** Optional grouping key — workspaces with the same `group` cluster. */
  group?: string;
}

// ─────────────────────────────────────────────────────────────
// Slots (shared across every sub-component)
// ─────────────────────────────────────────────────────────────

const switcherStyles = tv({
  slots: {
    trigger:
      "flex w-full items-center gap-s-3 px-s-3 py-s-2 text-left " +
      "bg-transparent outline-none rounded-xs " +
      "transition-colors duration-fast ease-out " +
      "data-[hovered=true]:bg-surface-03 " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember " +
      "data-[pressed=true]:bg-surface-03",
    identity: "flex min-w-0 flex-col",
    name: "truncate font-sans text-sm text-ink-hi",
    plan: "truncate font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
    chevron:
      "ml-auto h-4 w-4 shrink-0 text-ink-dim transition-transform duration-fast " +
      "group-data-[open=true]/trigger:rotate-180",
    popover:
      "z-50 min-w-[var(--trigger-width)] w-[var(--trigger-width)] " +
      "rounded-sm border border-hairline-strong bg-surface-02 shadow-panel outline-none " +
      "data-[entering=true]:animate-in data-[entering=true]:fade-in " +
      "data-[exiting=true]:animate-out data-[exiting=true]:fade-out",
    search: "border-b border-hairline p-s-2",
    searchInput:
      "w-full bg-surface-00 border border-hairline-strong rounded-xs " +
      "px-s-2 py-s-1 font-mono text-mono-sm text-ink placeholder:text-ink-faint " +
      "outline-none " +
      "data-[focused=true]:border-ember",
    menu: "max-h-[320px] overflow-auto py-s-1 outline-none",
    section: "py-s-1",
    sectionHeader:
      "px-s-3 pt-s-2 pb-s-1 font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
    item:
      "relative flex cursor-pointer select-none items-center gap-s-3 " +
      "px-s-3 py-s-2 outline-none " +
      "data-[focused=true]:bg-surface-03 " +
      "data-[selected=true]:bg-row-active",
    itemIdentity: "flex min-w-0 flex-col",
    itemName: "truncate font-sans text-sm text-ink",
    itemPlan:
      "truncate font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
    check: "ml-auto h-4 w-4 shrink-0 text-ember",
    footer: "border-t border-hairline p-s-1 flex flex-col gap-[2px]",
    footerAction:
      "flex items-center gap-s-2 rounded-xs px-s-3 py-s-2 text-left " +
      "font-sans text-sm text-ink-lo outline-none " +
      "data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    emptyState: "px-s-3 py-s-4 text-center font-mono text-mono-sm text-ink-dim",
  },
});

type SwitcherSlots = ReturnType<typeof switcherStyles>;

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

interface WorkspaceSwitcherContextValue {
  slots: SwitcherSlots;
  current: WorkspaceSwitcherEntry;
  workspaces: WorkspaceSwitcherEntry[];
  filteredWorkspaces: WorkspaceSwitcherEntry[];
  onSelect?: (workspaceId: string) => void;
  query: string;
  setQuery: (q: string) => void;
  isSearchable: boolean;
  searchPlaceholder: string;
  noMatchesMessage: React.ReactNode;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  triggerWidth: number | null;
}

const WorkspaceSwitcherContext =
  React.createContext<WorkspaceSwitcherContextValue | null>(null);

function useSwitcherContext(from: string): WorkspaceSwitcherContextValue {
  const ctx = React.useContext(WorkspaceSwitcherContext);
  if (!ctx) {
    throw new Error(
      `WorkspaceSwitcher.${from} must be rendered inside <WorkspaceSwitcher>.`
    );
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

export interface WorkspaceSwitcherRootProps {
  /** Currently selected workspace. */
  current: WorkspaceSwitcherEntry;
  /** Full list of workspaces available to switch to. */
  workspaces: WorkspaceSwitcherEntry[];
  /** Called with the selected workspace's id. */
  onSelect?: (workspaceId: string) => void;
  /**
   * When the list has more than this many workspaces, an inline search
   * input filters results (rendered by `<WorkspaceSwitcher.Search>` or
   * by the default layout).
   * @default 6
   */
  searchThreshold?: number;
  /** Placeholder text for the search field. */
  searchPlaceholder?: string;
  /** Empty-state message for "no matches". */
  noMatchesMessage?: React.ReactNode;

  /**
   * Controlled open state. Omit for uncontrolled.
   */
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;

  /**
   * Convenience props for the batteries-included layout (used when
   * `children` is omitted). When `children` is provided, these are
   * still wired through context so a `<WorkspaceSwitcher.Action>` can
   * call them if desired.
   */
  onCreate?: () => void;
  onManage?: () => void;
  createLabel?: React.ReactNode;
  manageLabel?: React.ReactNode;

  /** Either composed children (compound API) or omitted for defaults. */
  children?: React.ReactNode;
}

function groupBy<T>(
  items: T[],
  keyOf: (item: T) => string | undefined
): Array<{ key: string | undefined; items: T[] }> {
  const seenOrder: Array<string | undefined> = [];
  const buckets = new Map<string | undefined, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    if (!buckets.has(k)) {
      buckets.set(k, []);
      seenOrder.push(k);
    }
    buckets.get(k)!.push(it);
  }
  return seenOrder.map((k) => ({ key: k, items: buckets.get(k)! }));
}

function WorkspaceSwitcherRoot({
  current,
  workspaces,
  onSelect,
  searchThreshold = 6,
  searchPlaceholder = "Search workspaces",
  noMatchesMessage = "No workspaces match",
  isOpen: controlledOpen,
  defaultOpen,
  onOpenChange,
  onCreate,
  onManage,
  createLabel = "Create workspace",
  manageLabel = "Manage workspaces",
  children,
}: WorkspaceSwitcherRootProps) {
  const slots = React.useMemo(() => switcherStyles(), []);

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false
  );
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const [query, setQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [triggerWidth, setTriggerWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const el = triggerRef.current;
    if (!el) return;
    setTriggerWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setTriggerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const isSearchable = workspaces.length > searchThreshold;
  const filteredWorkspaces = React.useMemo(() => {
    if (!query) return workspaces;
    const q = query.toLowerCase();
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.plan ?? "").toLowerCase().includes(q)
    );
  }, [workspaces, query]);

  const ctx: WorkspaceSwitcherContextValue = React.useMemo(
    () => ({
      slots,
      current,
      workspaces,
      filteredWorkspaces,
      onSelect,
      query,
      setQuery,
      isSearchable,
      searchPlaceholder,
      noMatchesMessage,
      isOpen,
      setOpen,
      triggerRef,
      triggerWidth,
    }),
    [
      slots,
      current,
      workspaces,
      filteredWorkspaces,
      onSelect,
      query,
      isSearchable,
      searchPlaceholder,
      noMatchesMessage,
      isOpen,
      setOpen,
      triggerWidth,
    ]
  );

  return (
    <WorkspaceSwitcherContext.Provider value={ctx}>
      {children ?? (
        <DefaultLayout
          onCreate={onCreate}
          onManage={onManage}
          createLabel={createLabel}
          manageLabel={manageLabel}
        />
      )}
    </WorkspaceSwitcherContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Default layout (batteries-included) — rendered when no children
// ─────────────────────────────────────────────────────────────

function DefaultLayout({
  onCreate,
  onManage,
  createLabel,
  manageLabel,
}: {
  onCreate?: () => void;
  onManage?: () => void;
  createLabel: React.ReactNode;
  manageLabel: React.ReactNode;
}) {
  const hasFooter = Boolean(onCreate || onManage);
  return (
    <>
      <WorkspaceSwitcherTrigger />
      <WorkspaceSwitcherPopover>
        <WorkspaceSwitcherSearch />
        <WorkspaceSwitcherList />
        {hasFooter ? (
          <WorkspaceSwitcherFooter>
            {onCreate ? (
              <WorkspaceSwitcherAction onClick={onCreate} icon={<PlusIcon />}>
                {createLabel}
              </WorkspaceSwitcherAction>
            ) : null}
            {onManage ? (
              <WorkspaceSwitcherAction onClick={onManage} icon={<GearIcon />}>
                {manageLabel}
              </WorkspaceSwitcherAction>
            ) : null}
          </WorkspaceSwitcherFooter>
        ) : null}
      </WorkspaceSwitcherPopover>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

export interface WorkspaceSwitcherTriggerProps {
  className?: string;
  children?: React.ReactNode;
}

function WorkspaceSwitcherTrigger({
  className,
  children,
}: WorkspaceSwitcherTriggerProps) {
  const { slots, current, triggerRef, isOpen, setOpen } =
    useSwitcherContext("Trigger");
  return (
    <button
      type="button"
      ref={triggerRef}
      data-slot="workspace-switcher-trigger"
      className={`group/trigger ${slots.trigger()}${className ? ` ${className}` : ""}`}
      aria-label="Switch workspace"
      aria-expanded={isOpen}
      onClick={() => setOpen(!isOpen)}
    >
      {children ?? (
        <>
          <Avatar size="sm" tone={current.avatarTone}>
            {current.avatarUrl ? (
              <AvatarImage src={current.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>
              {deriveInitials(current.name, current.initials)}
            </AvatarFallback>
          </Avatar>
          <span className={slots.identity()}>
            <span className={slots.name()}>{current.name}</span>
            {current.plan ? (
              <span className={slots.plan()}>{current.plan}</span>
            ) : null}
          </span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className={slots.chevron()}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </>
      )}
    </button>
  );
}

export interface WorkspaceSwitcherPopoverProps {
  className?: string;
  children: React.ReactNode;
}

function WorkspaceSwitcherPopover({
  className,
  children,
}: WorkspaceSwitcherPopoverProps) {
  const { slots, triggerWidth, isOpen } = useSwitcherContext("Popover");
  const style = triggerWidth
    ? ({ "--trigger-width": `${triggerWidth}px` } as React.CSSProperties)
    : undefined;
  if (!isOpen) return null;

  return (
    <div
      data-slot="workspace-switcher-popover"
      className={`${slots.popover()}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

export interface WorkspaceSwitcherSearchProps {
  className?: string;
  /** Force the search field to render even when below the threshold. */
  force?: boolean;
  /** Hide the search even when above the threshold. */
  hidden?: boolean;
}

function WorkspaceSwitcherSearch({
  className,
  force,
  hidden,
}: WorkspaceSwitcherSearchProps) {
  const { slots, isSearchable, searchPlaceholder, query, setQuery } =
    useSwitcherContext("Search");

  const shouldRender = hidden ? false : force ? true : isSearchable;
  if (!shouldRender) return null;

  return (
    <div
      data-slot="workspace-switcher-search"
      className={slots.search({ className })}
    >
      <input
        aria-label={searchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        autoFocus
        placeholder={searchPlaceholder}
        className={slots.searchInput()}
      />
    </div>
  );
}

export interface WorkspaceSwitcherListProps {
  className?: string;
  /**
   * Override the items rendered. Useful for injecting custom rows
   * (e.g. a "Recent" section before the full list). If omitted, the
   * list auto-renders from `workspaces` + `group` from context.
   */
  children?: React.ReactNode;
}

function WorkspaceSwitcherList({
  className,
  children,
}: WorkspaceSwitcherListProps) {
  const {
    slots,
    filteredWorkspaces,
    current,
    onSelect,
    setOpen,
    noMatchesMessage,
  } = useSwitcherContext("List");

  if (filteredWorkspaces.length === 0) {
    return (
      <div
        data-slot="workspace-switcher-empty"
        className={slots.emptyState({ className })}
      >
        {noMatchesMessage}
      </div>
    );
  }

  const grouped = groupBy(filteredWorkspaces, (w) => w.group);

  return (
    <div
      data-slot="workspace-switcher-list"
      role="listbox"
      aria-label="Workspaces"
      className={slots.menu({ className })}
    >
      {children ??
        grouped.map(({ key, items }) => {
          const rows = items.map((w) => (
            <WorkspaceSwitcherItem key={w.id} workspace={w} />
          ));
          if (!key)
            return <React.Fragment key="__ungrouped">{rows}</React.Fragment>;
          return (
            <WorkspaceSwitcherSection key={key} title={key}>
              {rows}
            </WorkspaceSwitcherSection>
          );
        })}
    </div>
  );
}

export interface WorkspaceSwitcherSectionProps {
  title?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function WorkspaceSwitcherSection({
  title,
  className,
  children,
}: WorkspaceSwitcherSectionProps) {
  const { slots } = useSwitcherContext("Section");
  return (
    <div
      data-slot="workspace-switcher-section"
      role="group"
      className={slots.section({ className })}
    >
      {title ? (
        <div className={slots.sectionHeader()}>{title}</div>
      ) : null}
      {children}
    </div>
  );
}

export interface WorkspaceSwitcherItemProps {
  workspace: WorkspaceSwitcherEntry;
  className?: string;
  /**
   * Replace the default item body. Receives the workspace and its
   * selected state so consumers can render a fully custom row.
   */
  children?:
    | React.ReactNode
    | ((state: {
        workspace: WorkspaceSwitcherEntry;
        isSelected: boolean;
      }) => React.ReactNode);
}

function WorkspaceSwitcherItem({
  workspace,
  className,
  children,
}: WorkspaceSwitcherItemProps) {
  const { slots, current, onSelect, setOpen } = useSwitcherContext("Item");
  const isSelected = workspace.id === current.id;

  return (
    <button
      type="button"
      data-slot="workspace-switcher-item"
      role="option"
      aria-selected={isSelected}
      data-selected={isSelected || undefined}
      className={slots.item({ className })}
      onClick={() => {
        if (!isSelected) onSelect?.(workspace.id);
        setOpen(false);
      }}
    >
      {typeof children === "function"
        ? children({ workspace, isSelected })
        : (children ?? (
            <>
              <Avatar size="sm" tone={workspace.avatarTone}>
                {workspace.avatarUrl ? (
                  <AvatarImage src={workspace.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback>
                  {deriveInitials(workspace.name, workspace.initials)}
                </AvatarFallback>
              </Avatar>
              <span className={slots.itemIdentity()}>
                <span className={slots.itemName()}>{workspace.name}</span>
                {workspace.plan ? (
                  <span className={slots.itemPlan()}>{workspace.plan}</span>
                ) : null}
              </span>
              {isSelected ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className={slots.check()}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              ) : null}
            </>
          ))}
    </button>
  );
}

export interface WorkspaceSwitcherFooterProps {
  className?: string;
  /** Add the preceding separator. Defaults to true. */
  withSeparator?: boolean;
  children: React.ReactNode;
}

function WorkspaceSwitcherFooter({
  className,
  withSeparator = true,
  children,
}: WorkspaceSwitcherFooterProps) {
  const { slots } = useSwitcherContext("Footer");
  return (
    <>
      {withSeparator ? <div role="separator" className="h-px bg-hairline" /> : null}
      <div
        data-slot="workspace-switcher-footer"
        className={slots.footer({ className })}
      >
        {children}
      </div>
    </>
  );
}

export interface WorkspaceSwitcherActionProps {
  onClick?: () => void;
  onPress?: () => void;
  icon?: React.ReactNode;
  className?: string;
  /** Close the popover after the action fires. @default true */
  closeOnPress?: boolean;
  children: React.ReactNode;
}

function WorkspaceSwitcherAction({
  onClick,
  onPress,
  icon,
  className,
  closeOnPress = true,
  children,
}: WorkspaceSwitcherActionProps) {
  const { slots, setOpen } = useSwitcherContext("Action");
  return (
    <button
      type="button"
      data-slot="workspace-switcher-action"
      className={slots.footerAction({ className })}
      onClick={() => {
        if (closeOnPress) setOpen(false);
        onClick?.();
        onPress?.();
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons used by the default layout
// ─────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    className="h-4 w-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.5v15m7.5-7.5h-15"
    />
  </svg>
);

const GearIcon = () => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    className="h-4 w-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// Namespaced exports
// ─────────────────────────────────────────────────────────────

interface WorkspaceSwitcherNamespace {
  (props: WorkspaceSwitcherRootProps): React.ReactElement;
  Root: typeof WorkspaceSwitcherRoot;
  Trigger: typeof WorkspaceSwitcherTrigger;
  Popover: typeof WorkspaceSwitcherPopover;
  Search: typeof WorkspaceSwitcherSearch;
  List: typeof WorkspaceSwitcherList;
  Section: typeof WorkspaceSwitcherSection;
  Item: typeof WorkspaceSwitcherItem;
  Footer: typeof WorkspaceSwitcherFooter;
  Action: typeof WorkspaceSwitcherAction;
}

const WorkspaceSwitcher = WorkspaceSwitcherRoot as WorkspaceSwitcherNamespace;
WorkspaceSwitcher.Root = WorkspaceSwitcherRoot;
WorkspaceSwitcher.Trigger = WorkspaceSwitcherTrigger;
WorkspaceSwitcher.Popover = WorkspaceSwitcherPopover;
WorkspaceSwitcher.Search = WorkspaceSwitcherSearch;
WorkspaceSwitcher.List = WorkspaceSwitcherList;
WorkspaceSwitcher.Section = WorkspaceSwitcherSection;
WorkspaceSwitcher.Item = WorkspaceSwitcherItem;
WorkspaceSwitcher.Footer = WorkspaceSwitcherFooter;
WorkspaceSwitcher.Action = WorkspaceSwitcherAction;

export { WorkspaceSwitcher };

// Back-compat: root props were previously named `WorkspaceSwitcherProps`.
export type WorkspaceSwitcherProps = WorkspaceSwitcherRootProps;
