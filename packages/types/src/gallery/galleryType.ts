/** Storefront gallery contract shared by the API, dashboard and web app. */

export interface PublicGalleryPhoto<TDate = string> {
    id: string;
    /** Absolute URL or API-relative upload path. */
    image: string;
    /** Display title shown on the photo card. */
    name: string;
    /** Calendar date in `YYYY-MM-DD` form. */
    date: string;
    /** Free-form place label. */
    location: string;
    createdAt: TDate;
    updatedAt: TDate;
}

/** Global gallery state: the section toggle plus its photos. */
export interface GalleryState<TDate = string> {
    isActive: boolean;
    photos: PublicGalleryPhoto<TDate>[];
}

/** Admin-created photo; all display fields are entered manually. */
export interface GalleryPhotoPayload {
    image: string;
    name: string;
    date: string;
    location: string;
}

/** Admin toggle for the whole home-page gallery section. */
export interface GalleryStatusPayload {
    isActive: boolean;
}
