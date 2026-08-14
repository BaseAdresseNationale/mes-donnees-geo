const DEFAULT_URL_DISTRICT_FLAG = "/images/default-flag.svg";

export const getCommuneFlag = async (codeCommune: string): Promise<string> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_ANNUAIRE_DES_COLLECTIVITES}/commune/logo/${codeCommune}`,
    );

    if (!response.ok) {
      return DEFAULT_URL_DISTRICT_FLAG;
    }

    const { logo, blason } = (await response.json()) as {
      blason: string | null;
      logo: string | null;
    };

    const imgUrl = logo || blason;

    const isValidUrl =
      imgUrl && (imgUrl.startsWith("http") || imgUrl.startsWith("data:image"));

    if (!isValidUrl) {
      return DEFAULT_URL_DISTRICT_FLAG;
    }

    return imgUrl;
  } catch (err) {
    console.error(
      "Error fetching commune flag from annuaire des collectivités",
      err,
    );
    return DEFAULT_URL_DISTRICT_FLAG;
  }
};
