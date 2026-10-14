"use client";

import { Button } from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/navigation";

// Bouton icône (ex. « modifier », « ajouter ») qui ouvre une page
export function IconLinkButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="tertiary"
      color="neutral"
      size="small"
      icon={<span className="material-icons">{icon}</span>}
      aria-label={label}
      title={label}
      onClick={() => router.push(href)}
    />
  );
}
