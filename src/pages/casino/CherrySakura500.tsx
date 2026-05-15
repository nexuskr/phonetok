import CasinoLayout from "@/components/casino/CasinoLayout";
import OlympusSlot from "@/components/slots/OlympusSlot";
import { CHERRY_SAKURA_THEME } from "@/components/slots/themes";
import Disclaimer from "@/components/Disclaimer";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function CherrySakura500Page() {
  const user = useRequireAuth();
  if (!user) return null;
  return (
    <CasinoLayout backTo="/casino" backLabel="슬롯 로비로">
      <div className="container py-4 space-y-4">
        <OlympusSlot theme={CHERRY_SAKURA_THEME} />
        <Disclaimer />
      </div>
    </CasinoLayout>
  );
}
