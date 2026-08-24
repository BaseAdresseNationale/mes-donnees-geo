import { Button } from "@gouvfr-lasuite/ui-components";
import Image from "next/image";

interface CadastreButtonProps {
  isCadastreDisplayed?: boolean;
  onClick: () => void;
}

function CadastreButton({ isCadastreDisplayed, onClick }: CadastreButtonProps) {
  return (
    <Button
      onClick={onClick}
      title={
        isCadastreDisplayed ? "Masquer le cadastre" : "Afficher le cadastre"
      }
      color="neutral"
      variant="tertiary"
      style={{
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
        ...(isCadastreDisplayed && {
          borderBottomRightRadius: 0,
          borderTopRightRadius: 0,
          backgroundColor: "var(--color-primary)",
          color: "#fff",
        }),
      }}
    >
      <Image
        alt=""
        height={24}
        width={24}
        src="/icons/layout.svg"
        aria-hidden="true"
        // le SVG est chargé comme une image externe, currentColor ne s'applique pas : on inverse ses couleurs pour l'afficher en blanc
        style={isCadastreDisplayed ? { filter: "invert(1)" } : undefined}
      />
    </Button>
  );
}

export default CadastreButton;
