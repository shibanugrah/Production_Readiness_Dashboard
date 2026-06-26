import Link from "next/link";

import { EmptyState } from "@/components/dashboard/primitives";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <EmptyState
        title="Service not found"
        description="The requested page is not available in the authenticated workspace."
      />
      <Link
        href="/services"
        className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Back to services
      </Link>
    </div>
  );
}
