import { EmptyState, PageHeader, Panel } from "@/components/dashboard/primitives";

export default function EventsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        description="Operational event ingestion is not connected yet."
      />
      <Panel title="Operational Events">
        <EmptyState
          title="No operational events received yet"
          description="Webhook, job, extraction, deployment, and migration events will appear here after event ingestion is built."
        />
      </Panel>
    </div>
  );
}
