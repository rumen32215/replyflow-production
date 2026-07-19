"use client";

import { usePathname } from "next/navigation";
import { CustomerList, type CustomerListItem } from "@/components/dashboard/customers/customer-list";
import { cn } from "@/lib/utils";

/**
 * Two-pane relationship workspace — same responsive pattern as
 * Conversations (components/dashboard/conversations/conversations-shell.tsx):
 * desktop shows list + detail side by side, mobile shows one pane at a
 * time. Reused deliberately rather than reinvented.
 */
export function CustomersShell({
  customers,
  children,
}: {
  customers: CustomerListItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDetailView = pathname !== "/dashboard/customers";

  return (
    <div className="-mx-4 -mb-24 -mt-6 flex h-[calc(100vh-60px-56px)] overflow-hidden md:-mx-8 md:-mb-8 md:-mt-8 md:h-[calc(100vh-73px)]">
      <div
        className={cn(
          "w-full shrink-0 border-r border-border bg-card md:w-[360px]",
          isDetailView ? "hidden md:block" : "block"
        )}
      >
        <CustomerList customers={customers} />
      </div>

      <div className={cn("min-w-0 flex-1 flex-col overflow-y-auto bg-background", isDetailView ? "flex" : "hidden md:flex")}>
        {children}
      </div>
    </div>
  );
}
