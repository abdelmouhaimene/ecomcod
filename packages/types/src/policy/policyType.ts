/** Admin-managed policy article contract shared by the API, dashboard and web app. */

export interface PublicPolicyArticle<TDate = string> {
    id: string;
    title: string;
    body: string;
    /** Lower numbers appear first; ties fall back to creation order. */
    position: number;
    isActive: boolean;
    createdAt: TDate;
    updatedAt: TDate;
}

/** Admin-created policy article. Text is shared by every storefront locale. */
export interface PolicyArticlePayload {
    title: string;
    body: string;
    position?: number;
    isActive?: boolean;
}
