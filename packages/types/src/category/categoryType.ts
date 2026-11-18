/** Storefront category contract shared by the admin API and the dashboard. */

export interface PublicCategory<TDate = string> {
    id: string;
    name: string;
    /** Short unique code chosen by the admin. */
    ref: string;
    createdAt: TDate;
    updatedAt: TDate;
}

export interface CategoryPayload {
    name: string;
    ref: string;
}
