export type BANAddressProperties = {
  certifie: boolean;
  lieuDitComplementNom?: string;
  suffixe?: string;
  nomCommune: string;
  nomVoie: string;
  numero: number;
};

export function getAddressLabelFromFeature(
  properties: BANAddressProperties,
): React.ReactNode {
  const { numero, suffixe, nomVoie, lieuDitComplementNom, nomCommune } =
    properties;
  return (
    <div>
      <div>
        {numero}
        {suffixe ? ` ${suffixe},` : ","} {nomVoie}
      </div>
      {lieuDitComplementNom ? <div>{lieuDitComplementNom}</div> : null}
    </div>
  );
}
