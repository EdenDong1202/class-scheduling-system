import type React from "react"
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ErrorReporter, ConsoleReporter, ReactErrorBoundary } from "@/components/error-reporter"
import { AppAnalytics } from "@/components/app-analytics"

export const metadata: Metadata = {
  title: "排课看板",
  description: "校区教室排课可视化看板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ReactErrorBoundary>
          {children}
        </ReactErrorBoundary>
        <Toaster />
        <ErrorReporter />
        <ConsoleReporter />
        <AppAnalytics />
      </body>
    </html>
  );
}
