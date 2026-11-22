/** Storefront category contract shared by the admin API and the dashboard. */

export interface PublicCategory<TDate = string> {
    id: string;
    name: string;
    /** Short unique code chosen by the admin. */
    ref: string;
    /** URL of the optional icon image, or `null` when none is set. */
    icon: string | null;
    createdAt: TDate;
    updatedAt: TDate;
}

export interface CategoryPayload {
    name: string;
    ref: string;
    /** Uploaded icon URL; empty or whitespace clears the icon. */
    icon?: string | null;
}
