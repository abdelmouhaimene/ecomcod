import { createHash } from 'node:crypto';
import type { ProductVariant } from './entities/product-variant.entity.js';
import type { ProductVariantValue } from './entities/product-variant-value.entity.js';

export const DEFAULT_COMBINATION_KEY = 'DEFAULT';

export type VariantDefinition = Pick<ProductVariant, 'id' | 'name' | 'variantType'> & {
    values: ProductVariantValue[];
};

/** `OTHER` uses the user-created type name; built-ins use their enum value. */
export function variantDimension(variant: Pick<ProductVariant, 'variantType' | 'name'>): string {
    return variant.variantType === 'OTHER'
        ? `OTHER:${variant.name.trim().toLowerCase()}`
        : variant.variantType;
}

export function variantValue(
    value: Pick<ProductVariantValue, 'value'>,
    variantType: ProductVariant['variantType'],
): string {
    return variantType === 'SIZE_TEXT' ? value.value.trim().toUpperCase() : value.value.trim();
}

export interface SkuCombination {
    combinationKey: string;
    label: string;
    variantValueIds: string[];
    imageId: string | null;
}

/** Builds one combination from a set of values, with sorted dimensions. */
export function buildCombination(
    values: Array<{ value: ProductVariantValue; definition: VariantDefinition }>,
    fallbackImageId: string | null,
): SkuCombination {
    if (values.length === 0) {
        return {
            combinationKey: DEFAULT_COMBINATION_KEY,
            label: 'Default',
            variantValueIds: [],
            imageId: fallbackImageId,
        };
    }

    const parts = values
        .map(({ value, definition }) => ({
            dimension: variantDimension(definition),
            value: variantValue(value, definition.variantType),
            imageId: value.imageId,
        }))
        .sort(
            (a, b) =>
                a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value),
        );

    return {
        combinationKey: parts.map((part) => `${part.dimension}:${part.value}`).join('|'),
        label: parts.map((part) => part.value).join(' / '),
        variantValueIds: values.map(({ value }) => value.id).sort(),
        imageId: parts[0]?.imageId ?? fallbackImageId,
    };
}

export function variantValueIdKey(ids: string[]): string {
    return [...ids].sort().join(',');
}

/**
 * Returns the cross product of a product's variant values:
 * Red/White × S/M yields four sellable SKUs.
 */
export function valueCombinations(
    variants: VariantDefinition[],
): Array<Array<{ value: ProductVariantValue; definition: VariantDefinition }>> {
    let combinations: Array<Array<{ value: ProductVariantValue; definition: VariantDefinition }>> = [[]];
    for (const definition of variants) {
        const group = [...definition.values].sort(
            (a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
        );
        combinations = combinations.flatMap((combination) =>
            group.map((value) => [...combination, { value, definition }]),
        );
    }
    return combinations;
}

export function skuCode(ref: string, combinationKey: string): string {
    const normalized = ref.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const hash = createHash('sha1').update(combinationKey).digest('hex').slice(0, 8);
    return `${normalized || 'PRODUCT'}-${hash}`;
}
