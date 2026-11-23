import {
  SIZE_TEXT_VALUES,
  type PublicProduct,
  type PublicProductSku,
  type PublicProductVariant,
  type PublicProductVariantValue,
  type VariantType,
} from '@repo/types';

const SIZE_TEXT_SET = new Set<string>(SIZE_TEXT_VALUES);

export const VARIANT_LABEL_KEYS = {
  COLOR: 'variantTypes.color',
  SIZE_TEXT: 'variantTypes.sizeText',
  SIZE_NUM: 'variantTypes.sizeNum',
  DESIGN: 'variantTypes.design',
  OTHER: 'variantTypes.other',
} as const satisfies Record<VariantType, string>;

export interface VariantGroup {
  key: string;
  name: string;
  variantType: VariantType;
  options: PublicProductVariantValue[];
}

export interface VariantOption {
  value: string;
  variant: PublicProductVariantValue | null;
}

export type VariantSelection = Record<string, string>;

function variantGroupKey(variant: PublicProductVariant): string {
  return `${variant.variantType}:${variant.name}`;
}

export function buildVariantGroups(product: PublicProduct): VariantGroup[] {
  const groups = new Map<string, VariantGroup>();
  for (const variant of product.variants) {
    const key = variantGroupKey(variant);
    const group = groups.get(key);
    if (group) {
      group.options.push(...variant.values);
    } else {
      groups.set(key, {
        key,
        name: variant.name,
        variantType: variant.variantType,
        options: [...variant.values],
      });
    }
  }
  return [...groups.values()];
}

export function buildVariantOptions(group: VariantGroup): VariantOption[] {
  const hasCanonicalSizes = group.options.some((option) =>
    SIZE_TEXT_SET.has(option.value.toUpperCase())
  );

  if (group.variantType === 'SIZE_TEXT' && hasCanonicalSizes) {
    const canonical: VariantOption[] = SIZE_TEXT_VALUES.map((value) => ({
      value,
      variant:
        group.options.find((option) => option.value.toUpperCase() === value) ?? null,
    }));
    const extras: VariantOption[] = group.options
      .filter((option) => !SIZE_TEXT_SET.has(option.value.toUpperCase()))
      .map((option) => ({ value: option.value, variant: option }));
    return [...canonical, ...extras];
  }

  return group.options.map((option) => ({ value: option.value, variant: option }));
}

export function selectedVariantIds(selection: VariantSelection): string[] {
  return Object.values(selection).filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
}

function usableSkus(product: PublicProduct, minimumStock: number): PublicProductSku[] {
  return product.skus.filter(
    (sku) => sku.isActive && sku.stockQuantity >= Math.max(1, minimumStock)
  );
}

/** Finds the SKU matching the chosen variants, with enough stock for an offer. */
export function findSelectedSku(
  product: PublicProduct,
  selection: VariantSelection,
  minimumStock = 1
): PublicProductSku | null {
  const selectedIds = selectedVariantIds(selection);
  return (
    usableSkus(product, minimumStock).find(
      (sku) =>
        sku.variantValueIds.length === selectedIds.length &&
        selectedIds.every((id) => sku.variantValueIds.includes(id))
    ) ?? null
  );
}

/** A variant is selectable only if some SKU can satisfy it with the current choices. */
export function canSelectVariant(
  product: PublicProduct,
  selection: VariantSelection,
  groupKey: string,
  valueId: string,
  minimumStock = 1
): boolean {
  const otherIds = Object.entries(selection)
    .filter(([key]) => key !== groupKey)
    .map(([, id]) => id)
    .filter(Boolean);
  return usableSkus(product, minimumStock).some(
    (sku) =>
      sku.variantValueIds.includes(valueId) &&
      otherIds.every((id) => sku.variantValueIds.includes(id))
  );
}

/** Initializes one selection per variant group from the first usable SKU. */
export function initialVariantSelection(
  product: PublicProduct,
  groups: VariantGroup[],
  minimumStock = 1
): VariantSelection {
  const first = usableSkus(product, minimumStock)[0] ?? product.skus[0];
  const next: VariantSelection = {};
  for (const group of groups) {
    const matchingId = first?.variantValueIds.find((id) =>
      group.options.some((option) => option.id === id)
    );
    const valueId = matchingId ?? group.options[0]?.id;
    if (valueId) next[group.key] = valueId;
  }
  return next;
}
