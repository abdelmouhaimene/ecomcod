'use client';

import type { PolicyArticlePayload, PublicPolicyArticle } from '@repo/types';
import { adminApi } from '../../lib/admin-api';
import {
    ContentManager,
    type ContentLabels,
    type ContentManagerConfig,
} from './content-manager';

const labels: ContentLabels = {
    title: 'policyTitle',
    subtitle: 'policySubtitle',
    primary: 'policyArticleTitle',
    secondary: 'policyBody',
    create: 'policyCreate',
    edit: 'policyEdit',
    created: 'policyCreated',
    updated: 'policyUpdated',
    deleted: 'policyDeleted',
    empty: 'policyEmpty',
    loadError: 'policyLoadError',
    createError: 'policyCreateError',
    updateError: 'policyUpdateError',
    deleteError: 'policyDeleteError',
    confirmDelete: 'policyConfirmDelete',
    count: 'policyCount',
    search: 'policySearch',
    noResults: 'policyNoResults',
    primaryRequired: 'policyTitleRequired',
    secondaryRequired: 'policyBodyRequired',
};

const config: ContentManagerConfig<PublicPolicyArticle, PolicyArticlePayload> = {
    labels,
    list: () => adminApi.listPolicies(),
    create: (payload) => adminApi.createPolicy(payload),
    update: (id, payload) => adminApi.updatePolicy(id, payload),
    remove: (id) => adminApi.removePolicy(id),
    toRow: (article) => ({
        id: article.id,
        primary: article.title,
        secondary: article.body,
        position: article.position,
        isActive: article.isActive,
        createdAt: article.createdAt,
    }),
    buildPayload: (values) => ({
        title: values.primary,
        body: values.secondary,
        position: values.position,
        isActive: values.isActive,
    }),
};

export function PolicyManager(): React.JSX.Element {
    return <ContentManager config={config} />;
}
