import type { ReactNode } from "react";

import PcmGuard from "@/components/PcmGuard";

export default function PcmLayout({ children }: { children: ReactNode }) {
  return <PcmGuard allowlist={process.env.PCM_EMAILS}>{children}</PcmGuard>;
}
