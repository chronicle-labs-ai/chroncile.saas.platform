import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";

/**
 * SectionHeader — the "Brand foundations ——— 01—04 · FOUR CARDS" row.
 * Display heading + horizontal hairline rule + optional mono note.
 */
const sectionHeader = tv({
  slots: {
    root: "my-s-12 mb-s-5 flex items-baseline gap-s-5",
    title: "m-0 font-display font-medium tracking-tight text-ink-hi",
    rule: "h-px flex-1 bg-hairline",
    note: "font-mono text-mono-sm uppercase tracking-tactical text-ink-dim",
  },
  variants: {
    size: {
      md: { title: "text-title" },
      lg: { title: "text-title-lg" },
    },
  },
  defaultVariants: { size: "md" },
});

type SectionHeaderVariantProps = VariantProps<typeof sectionHeader>;

export interface SectionHeaderProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    SectionHeaderVariantProps {
  title: React.ReactNode;
  note?: React.ReactNode;
  as?: "h2" | "h3" | "h4";
  size?: "md" | "lg";
}

export function SectionHeader({
  title,
  note,
  as: Tag = "h3",
  size = "md",
  className,
  ...props
}: SectionHeaderProps) {
  const slots = sectionHeader({ size });
  return (
    <div className={slots.root({ className })} {...props}>
      <Tag className={slots.title()}>{title}</Tag>
      <span className={slots.rule()} />
      {note ? <span className={slots.note()}>{note}</span> : null}
    </div>
  );
}
