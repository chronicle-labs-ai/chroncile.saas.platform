/*
 * Framework meta — display-only metadata for each `AgentFramework`.
 *
 * Framework is metadata only in the UI: a small badge on cards, rows,
 * and run entries. It is never a primary filter or comparison axis.
 *
 * For the visual mark we pull the *company* behind the framework
 * through `<CompanyLogo>` (logo.dev) so e.g. `vercel-ai-sdk` shows
 * the real Vercel triangle. The lucide `Icon` here is kept as a
 * fallback for when logo.dev is unreachable or the brand isn't on
 * file.
 *
 * The `--c-event-*` color tokens in `tile` / `ink` / `dot` give
 * each framework a tonal accent that pairs with the company logo —
 * keeping the chrome aligned with `DATASET_PURPOSE_META` and the
 * rest of the Linear-density product chrome.
 */

import {
  Bot,
  Boxes,
  Brain,
  Cog,
  Cpu,
  GitBranch,
  Network,
  Package,
  Sparkles,
  TerminalSquare,
  Workflow,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AgentFramework } from "./types";

export interface FrameworkMeta {
  /** Display label rendered in the chip. */
  label: string;
  /** Name passed to `<CompanyLogo>` for logo.dev resolution. */
  companyName: string;
  /** Optional domain override for `<CompanyLogo>` when logo.dev's
   *  default `<name>.com` guess is wrong (e.g. mastra.ai). */
  companyDomain?: string;
  /** Lucide fallback used by the badge when the company logo cannot
   *  be loaded. */
  Icon: LucideIcon;
  /** Background tint used for the badge (and the icon tile in cards). */
  tile: string;
  /** Glyph / accent color paired with the tile. */
  ink: string;
  /** Small leading dot color when used inline (no tile). */
  dot: string;
  /** Short "language family" hint shown in the run drawer. */
  family: "typescript" | "python";
}

export const FRAMEWORK_META: Record<AgentFramework, FrameworkMeta> = {
  "vercel-ai-sdk": {
    label: "Vercel AI SDK",
    companyName: "vercel",
    companyDomain: "vercel.com",
    Icon: Sparkles,
    tile: "bg-event-teal/12",
    ink: "text-event-teal",
    dot: "bg-event-teal",
    family: "typescript",
  },
  "openai-agents": {
    label: "OpenAI Agents",
    companyName: "openai",
    companyDomain: "openai.com",
    Icon: Brain,
    tile: "bg-event-green/12",
    ink: "text-event-green",
    dot: "bg-event-green",
    family: "typescript",
  },
  langchain: {
    label: "LangChain",
    companyName: "langchain",
    companyDomain: "langchain.com",
    Icon: GitBranch,
    tile: "bg-event-violet/12",
    ink: "text-event-violet",
    dot: "bg-event-violet",
    family: "typescript",
  },
  mastra: {
    label: "Mastra",
    companyName: "mastra",
    companyDomain: "mastra.ai",
    Icon: Workflow,
    tile: "bg-event-amber/12",
    ink: "text-event-amber",
    dot: "bg-event-amber",
    family: "typescript",
  },
  "langchain-python": {
    label: "LangChain (Python)",
    companyName: "langchain",
    companyDomain: "langchain.com",
    Icon: GitBranch,
    tile: "bg-event-violet/12",
    ink: "text-event-violet",
    dot: "bg-event-violet",
    family: "python",
  },
  llamaindex: {
    label: "LlamaIndex",
    companyName: "llamaindex",
    companyDomain: "llamaindex.ai",
    Icon: Network,
    tile: "bg-event-pink/12",
    ink: "text-event-pink",
    dot: "bg-event-pink",
    family: "python",
  },
  crewai: {
    label: "CrewAI",
    companyName: "crewai",
    companyDomain: "crewai.com",
    Icon: Boxes,
    tile: "bg-event-orange/12",
    ink: "text-event-orange",
    dot: "bg-event-orange",
    family: "python",
  },
  smolagents: {
    label: "SmolAgents",
    companyName: "huggingface",
    companyDomain: "huggingface.co",
    Icon: Bot,
    tile: "bg-event-teal/12",
    ink: "text-event-teal",
    dot: "bg-event-teal",
    family: "python",
  },
  "pydantic-ai": {
    label: "PydanticAI",
    companyName: "pydantic",
    companyDomain: "pydantic.dev",
    Icon: Package,
    tile: "bg-event-red/12",
    ink: "text-event-red",
    dot: "bg-event-red",
    family: "python",
  },
  strands: {
    label: "Strands",
    companyName: "aws",
    companyDomain: "aws.amazon.com",
    Icon: Zap,
    tile: "bg-event-amber/12",
    ink: "text-event-amber",
    dot: "bg-event-amber",
    family: "python",
  },
  "google-adk": {
    label: "Google ADK",
    companyName: "google",
    companyDomain: "google.com",
    Icon: Cpu,
    tile: "bg-event-green/12",
    ink: "text-event-green",
    dot: "bg-event-green",
    family: "python",
  },
  "openai-agents-python": {
    label: "OpenAI Agents (Python)",
    companyName: "openai",
    companyDomain: "openai.com",
    Icon: Brain,
    tile: "bg-event-green/12",
    ink: "text-event-green",
    dot: "bg-event-green",
    family: "python",
  },
  autogen: {
    label: "AutoGen",
    companyName: "microsoft",
    companyDomain: "microsoft.com",
    Icon: Cog,
    tile: "bg-event-violet/12",
    ink: "text-event-violet",
    dot: "bg-event-violet",
    family: "python",
  },
};

/* ── Model provider meta ───────────────────────────────────── */

/**
 * Maps a `model.provider` string from the wrapper (e.g.
 * `"openai.responses"`, `"openai"`, `"anthropic"`) to a normalized
 * company name + display label. The `<CompanyLogo>` component does
 * the rest via logo.dev.
 *
 * Unknown providers fall through to `null` and the consumer can
 * decide whether to render a neutral fallback or the raw label.
 */
export interface ModelProviderMeta {
  /** Display label ("OpenAI", "Anthropic", "Google"). */
  label: string;
  /** Name passed to `<CompanyLogo>`. */
  companyName: string;
  /** Optional domain override for `<CompanyLogo>`. */
  companyDomain?: string;
}

const PROVIDER_PREFIX_META: ReadonlyArray<{
  prefix: string;
  meta: ModelProviderMeta;
}> = [
  {
    prefix: "openai",
    meta: { label: "OpenAI", companyName: "openai", companyDomain: "openai.com" },
  },
  {
    prefix: "anthropic",
    meta: { label: "Anthropic", companyName: "anthropic", companyDomain: "anthropic.com" },
  },
  {
    prefix: "google",
    meta: { label: "Google", companyName: "google", companyDomain: "google.com" },
  },
  {
    prefix: "azure",
    meta: { label: "Azure", companyName: "microsoft", companyDomain: "azure.microsoft.com" },
  },
  {
    prefix: "mistral",
    meta: { label: "Mistral", companyName: "mistral", companyDomain: "mistral.ai" },
  },
  {
    prefix: "cohere",
    meta: { label: "Cohere", companyName: "cohere", companyDomain: "cohere.com" },
  },
  {
    prefix: "groq",
    meta: { label: "Groq", companyName: "groq", companyDomain: "groq.com" },
  },
  {
    prefix: "perplexity",
    meta: {
      label: "Perplexity",
      companyName: "perplexity",
      companyDomain: "perplexity.ai",
    },
  },
  {
    prefix: "vercel",
    meta: { label: "Vercel", companyName: "vercel", companyDomain: "vercel.com" },
  },
  {
    prefix: "aws",
    meta: { label: "AWS Bedrock", companyName: "aws", companyDomain: "aws.amazon.com" },
  },
  {
    prefix: "bedrock",
    meta: { label: "AWS Bedrock", companyName: "aws", companyDomain: "aws.amazon.com" },
  },
];

export function getModelProviderMeta(
  provider: string | undefined,
): ModelProviderMeta | null {
  if (!provider) return null;
  const lower = provider.toLowerCase();
  for (const entry of PROVIDER_PREFIX_META) {
    if (lower === entry.prefix || lower.startsWith(`${entry.prefix}.`) || lower.startsWith(`${entry.prefix}/`)) {
      return entry.meta;
    }
  }
  return null;
}

/**
 * Color + icon for each hash domain, used by `HashDomainChip` and the
 * `AgentVersionCompare` section headers.
 */
export const HASH_DOMAIN_META = {
  "agent.root": {
    label: "Agent root",
    Icon: Boxes,
    ink: "text-l-ink-lo",
    dot: "bg-l-ink-dim",
  },
  prompt: {
    label: "Prompt",
    Icon: TerminalSquare,
    ink: "text-event-teal",
    dot: "bg-event-teal",
  },
  "model.contract": {
    label: "Model",
    Icon: Brain,
    ink: "text-event-green",
    dot: "bg-event-green",
  },
  "provider.options": {
    label: "Provider opts",
    Icon: Cog,
    ink: "text-event-amber",
    dot: "bg-event-amber",
  },
  "tool.contract": {
    label: "Tools",
    Icon: Cpu,
    ink: "text-event-violet",
    dot: "bg-event-violet",
  },
  "runtime.policy": {
    label: "Policy",
    Icon: Workflow,
    ink: "text-event-orange",
    dot: "bg-event-orange",
  },
  dependency: {
    label: "Dependency",
    Icon: Package,
    ink: "text-event-pink",
    dot: "bg-event-pink",
  },
  "knowledge.contract": {
    label: "Knowledge",
    Icon: Network,
    ink: "text-event-teal",
    dot: "bg-event-teal",
  },
  "workflow.graph": {
    label: "Workflow",
    Icon: GitBranch,
    ink: "text-event-violet",
    dot: "bg-event-violet",
  },
  "effective.run": {
    label: "Effective call",
    Icon: Zap,
    ink: "text-event-amber",
    dot: "bg-event-amber",
  },
  "provider.observation": {
    label: "Provider obs",
    Icon: Sparkles,
    ink: "text-event-green",
    dot: "bg-event-green",
  },
  operational: {
    label: "Operational",
    Icon: Cog,
    ink: "text-event-orange",
    dot: "bg-event-orange",
  },
  output: {
    label: "Output",
    Icon: Bot,
    ink: "text-event-teal",
    dot: "bg-event-teal",
  },
} as const;
