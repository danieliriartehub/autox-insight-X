import { Bell, Search, UserCircle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4">
      <SidebarTrigger />
      <div className="flex flex-col leading-tight">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">3</Badge>
        </Button>
        <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
          <UserCircle className="h-5 w-5 text-primary" />
          <div className="hidden text-xs leading-tight sm:block">
            <div className="font-medium">{user?.nombre_completo || ""}</div>
            <div className="text-muted-foreground">{user?.cargo || ""}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
