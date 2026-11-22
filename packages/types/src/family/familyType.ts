/**
 * Product family contracts. Families are separate from categories: a product
 * can belong to many families and a family can group many products.
 */
export interface PublicFamily<TDate = string> {
    id: string;
    name: string;
    ref: string;
    description: string | null;
    createdAt: TDate;
    updatedAt: TDate;
}

export interface FamilyPayload {
    name: string;
    ref: string;
    description?: string | null;
}
