"use client";

import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const APPS = [
  {
    id: "YOUR_TEABLE_APP_ID_1",
    name: "排课看板",
    url: "https://your-deployed-app.example.com",
    current: true,
  },
  {
    id: "YOUR_TEABLE_APP_ID_2",
    name: "班课管理",
    url: "https://your-app-url.example.com",
    current: false,
  },
];

export default function AppSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="切换应用"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          切换应用
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {APPS.map((app) => (
          <DropdownMenuItem
            key={app.id}
            disabled={app.current}
            className="cursor-pointer"
            onSelect={() => {
              if (!app.current) window.open(app.url, "_blank");
            }}
          >
            <span className={app.current ? "font-medium" : ""}>{app.name}</span>
            {app.current && (
              <span className="ml-auto text-[10px] text-muted-foreground">当前</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
