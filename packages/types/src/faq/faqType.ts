/** Admin-managed FAQ contract shared by the API, dashboard and web app. */

export interface PublicFaqItem<TDate = string> {
    id: string;
    question: string;
    answer: string;
    /** Lower numbers appear first; ties fall back to creation order. */
    position: number;
    isActive: boolean;
    createdAt: TDate;
    updatedAt: TDate;
}

/** Admin-created FAQ entry. Text is shared by every storefront locale. */
export interface FaqPayload {
    question: string;
    answer: string;
    position?: number;
    isActive?: boolean;
}
