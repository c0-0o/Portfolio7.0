"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/Button";

export function PortfolioActionButton({
  to,
  label,
  target,
  catAnimation = false,
}: {
  to: string;
  label: string;
  target?: "_blank";
  catAnimation?: boolean;
}) {
  const router = useRouter();

  return (
    <Button
      text={label}
      catAnimation={catAnimation}
      onClick={() => {
        if (target === "_blank") {
          window.open(to, "_blank", "noopener,noreferrer");
          return;
        }

        router.push(to);
      }}
    />
  );
}
