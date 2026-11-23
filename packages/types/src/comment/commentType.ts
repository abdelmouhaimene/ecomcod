/** Storefront testimonial contract shared by the API, dashboard and web app. */

export const COMMENT_SOURCES = ['USER', 'ADMIN'] as const;
export type CommentSource = (typeof COMMENT_SOURCES)[number];

export interface PublicComment<TDate = string> {
    id: string;
    /** Display name captured at creation time (account name or admin-entered). */
    username: string;
    /** Optional avatar URL; clients show initials when null. */
    userImage: string | null;
    content: string;
    /** Whole stars from 1 to 5. */
    rating: number;
    /** Internal origin: real verified user or admin-authored fake testimonial. */
    source: CommentSource;
    createdAt: TDate;
    updatedAt: TDate;
}

/** Posted by a verified storefront user; identity comes from the session. */
export interface CreateCommentPayload {
    content: string;
    rating: number;
}

/** Admin-authored testimonial: all display fields are entered manually. */
export interface CreateAdminCommentPayload {
    username: string;
    userImage?: string | null;
    content: string;
    rating: number;
}
