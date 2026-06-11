import { Badge } from "@/components/ui/badge";

const variant = (status: number | null | undefined) => {
  switch (status) {
    case 1:  return "default"   as const; // Open
    case 2:  return "secondary" as const; // Halted
    case 3:  return "outline"   as const; // Closed
    default: return "outline"   as const; // Pending
  }
};

const label = (status: number) => ["Pending","Open","Halted","Closed"][status] ?? "Unknown";

export function StatusBadge({ status }: { status: number | null | undefined }) {
  return <Badge variant={variant(status)}>{label(status ?? 0)}</Badge>;
}
