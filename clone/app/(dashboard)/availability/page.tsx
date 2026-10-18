import { AvailabilityForm } from "@/components/AvailabilityForm";
import { requireHost } from "@/lib/auth";
import { getOverrides, getRules } from "@/lib/store";

export default async function AvailabilityPage() {
  const { host } = await requireHost();
  return (
    <div className="space-y-6">
      <h1>Disponibilités</h1>
      <AvailabilityForm rules={await getRules(host.id)} overrides={await getOverrides(host.id)} timezone={host.timezone} />
    </div>
  );
}
