import type { Meta, StoryObj } from "@storybook/react";
import {
  AppWindow,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Cloud,
  Code2,
  Copy,
  Database,
  FileText,
  Globe,
  KeyRound,
  Link,
  LoaderCircle,
  Lock,
  Mail,
  MessageSquare,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

type IconSample = {
  name: string;
  Icon: LucideIcon;
};

const ICONS: IconSample[] = [
  { name: "AppWindow", Icon: AppWindow },
  { name: "Bell", Icon: Bell },
  { name: "Building2", Icon: Building2 },
  { name: "Check", Icon: Check },
  { name: "ChevronDown", Icon: ChevronDown },
  { name: "CircleAlert", Icon: CircleAlert },
  { name: "Cloud", Icon: Cloud },
  { name: "Code2", Icon: Code2 },
  { name: "Copy", Icon: Copy },
  { name: "Database", Icon: Database },
  { name: "FileText", Icon: FileText },
  { name: "Globe", Icon: Globe },
  { name: "KeyRound", Icon: KeyRound },
  { name: "Link", Icon: Link },
  { name: "LoaderCircle", Icon: LoaderCircle },
  { name: "Lock", Icon: Lock },
  { name: "Mail", Icon: Mail },
  { name: "MessageSquare", Icon: MessageSquare },
  { name: "Search", Icon: Search },
  { name: "Server", Icon: Server },
  { name: "Settings", Icon: Settings },
  { name: "ShieldCheck", Icon: ShieldCheck },
  { name: "Sparkles", Icon: Sparkles },
  { name: "User", Icon: User },
  { name: "Users", Icon: Users },
  { name: "Webhook", Icon: Webhook },
];

const meta: Meta = {
  title: "Icons/Shadcn Lucide",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Catalog: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-s-4">
      {ICONS.map(({ name, Icon }) => (
        <div
          key={name}
          className="flex flex-col items-center gap-s-2 rounded-sm border border-hairline bg-surface-01 p-s-4 text-ink-hi"
        >
          <Icon aria-hidden size={28} strokeWidth={1.75} />
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
};
