import CadastreSearch from "./CadastreSearch";
import CadastreButton from "./CadastreButton";
import cssStyles from "./CadastreControl.module.css";

export type CadastreControlProps = {
  showCadastre: boolean;
  setShowCadastre?: (show: boolean) => void;
};

export function CadastreControl({
  showCadastre,
  setShowCadastre,
}: CadastreControlProps) {
  if (!setShowCadastre) {
    return null;
  }

  return (
    <div className={cssStyles.controlContainer}>
      <CadastreButton
        isCadastreDisplayed={showCadastre}
        onClick={() => setShowCadastre(!showCadastre)}
      />
      <CadastreSearch visible={showCadastre} />
    </div>
  );
}
