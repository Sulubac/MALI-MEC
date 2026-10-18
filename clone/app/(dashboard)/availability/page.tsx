import { AvailabilityForm } from "@/components/AvailabilityForm";
import { getCurrentHost, getRules } from "@/lib/store";

export default function AvailabilityPage() {
  const host = getCurrentHost();
  return (
    <div className="space-y-6">
      <h1>Disponibilités</h1>
      <AvailabilityForm rules={getRules(host.id)} timezone={host.timezone} />
    </div>
  );
}
