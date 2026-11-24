export interface WilayaOption {
  code: string;
  name_fr: string;
  name_ar: string;
}

export interface CommuneOption {
  code: string;
  wilaya_code: string;
  name_fr: string;
  name_ar: string;
}

export interface LocationData {
  wilayas: WilayaOption[];
  communes: CommuneOption[];
}

type LocalizedLocation = Pick<WilayaOption, 'name_fr' | 'name_ar'>;

export function localizedLocationName(entry: LocalizedLocation, locale: string): string {
  return locale.toLowerCase().startsWith('ar')
    ? entry.name_ar || entry.name_fr
    : entry.name_fr || entry.name_ar;
}

/** Accept local, `+213` and `00213` Algerian mobiles; store the local form. */
export function normalizeAlgerianPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, '');
  if (/^0[567]\d{8}$/.test(compact)) return compact;

  const international = compact.replace(/^00213/, '+213');
  if (/^\+213[567]\d{8}$/.test(international)) {
    return `0${international.slice(4)}`;
  }
  if (/^213[567]\d{8}$/.test(compact)) {
    return `0${compact.slice(3)}`;
  }
  return null;
}

export async function fetchLocationData(): Promise<LocationData> {
  const readJson = async <T,>(path: string): Promise<T> => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return (await response.json()) as T;
  };

  const [wilayas, communes] = await Promise.all([
    readJson<WilayaOption[]>('/data/wilaya.json'),
    readJson<CommuneOption[]>('/data/commune.json'),
  ]);
  return { wilayas, communes };
}

export function communesForWilaya(
  communes: CommuneOption[],
  wilayaCode: string,
  locale: string,
): CommuneOption[] {
  return communes
    .filter((commune) => commune.wilaya_code === wilayaCode)
    .sort((a, b) =>
      localizedLocationName(a, locale).localeCompare(localizedLocationName(b, locale))
    );
}
