import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";

interface InfoCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function InfoCard({ title, icon: Icon, children, isLoading, className, "data-testid": testId }: InfoCardProps) {
  return (
    <Card className={className} data-testid={testId}>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

interface InfoRowProps {
  label: string;
  value: string | number | undefined | null;
  mono?: boolean;
  testId?: string;
}

export function InfoRow({ label, value, mono, testId }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? "font-mono" : ""}`} data-testid={testId}>
        {value ?? "—"}
      </span>
    </div>
  );
}
