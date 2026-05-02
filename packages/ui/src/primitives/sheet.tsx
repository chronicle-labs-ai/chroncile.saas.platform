/*
 * Sheet — alias of `Drawer` to match the upstream shadcn vocabulary.
 *
 * Chronicle's `Drawer` covers the same use case (slide-in side panel
 * over a modal scrim) and is what consumers should keep reaching for in
 * product code. This re-export exists so paste-in shadcn snippets that
 * import `Sheet` resolve cleanly.
 *
 * For the full compound API (`SheetTrigger`, `SheetHeader`, …) reach
 * for `<Drawer isOpen onClose title actions placement size>` directly
 * — the declarative API maps cleanly onto the same Radix Dialog under
 * the hood.
 */
export { Drawer as Sheet } from "./drawer";
export type { DrawerProps as SheetProps } from "./drawer";
