import * as React from "react";
import { Tag, type TagVariant } from "../primitives/tag";

/**
 * EventTag — semantic wrapper over `<Tag>` that names roles in the
 * system (CUSTOMER, AGENT, SYSTEM, DIVERGENCE) and picks the palette.
 *
 * The reason this exists as a separate component is to keep the role →
 * color mapping in *one* place and give stable visual semantics across
 * the product.
 */
export type EventRole = "customer" | "agent" | "system" | "divergence";

export interface EventTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  role: EventRole;
  /** Override the label text. Defaults to the uppercase role name. */
  label?: React.ReactNode;
}

const roleVariant: Record<EventRole, TagVariant> = {
  customer: "teal",
  agent: "amber",
  system: "green",
  divergence: "red",
};

export function EventTag({ role, label, className, ...props }: EventTagProps) {
  return (
    <Tag variant={roleVariant[role]} className={className} {...props}>
      {label ?? role.toUpperCase()}
    </Tag>
  );
}
