import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
}

export function KpiCard({ label, value, delta, trend = "neutral", icon: Icon, tone = "default" }: KpiCardProps) {
  const toneIcon = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className="border-border/60 shadow-sm transition hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            {delta && (
              <p className={cn("mt-1 text-xs font-medium", trendColor)}>{delta}</p>
            )}
          </div>
          <div className={cn("rounded-lg p-2.5", toneIcon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
