'use client';

import type { FaqPayload, PublicFaqItem } from '@repo/types';
import { adminApi } from '../../lib/admin-api';
import {
    ContentManager,
    type ContentLabels,
    type ContentManagerConfig,
} from './content-manager';

const labels: ContentLabels = {
    title: 'faqTitle',
    subtitle: 'faqSubtitle',
    primary: 'faqQuestion',
    secondary: 'faqAnswer',
    create: 'faqCreate',
    edit: 'faqEdit',
    created: 'faqCreated',
    updated: 'faqUpdated',
    deleted: 'faqDeleted',
    empty: 'faqEmpty',
    loadError: 'faqLoadError',
    createError: 'faqCreateError',
    updateError: 'faqUpdateError',
    deleteError: 'faqDeleteError',
    confirmDelete: 'faqConfirmDelete',
    count: 'faqCount',
    search: 'faqSearch',
    noResults: 'faqNoResults',
    primaryRequired: 'faqQuestionRequired',
    secondaryRequired: 'faqAnswerRequired',
};

const config: ContentManagerConfig<PublicFaqItem, FaqPayload> = {
    labels,
    list: () => adminApi.listFaqs(),
    create: (payload) => adminApi.createFaq(payload),
    update: (id, payload) => adminApi.updateFaq(id, payload),
    remove: (id) => adminApi.removeFaq(id),
    toRow: (item) => ({
        id: item.id,
        primary: item.question,
        secondary: item.answer,
        position: item.position,
        isActive: item.isActive,
        createdAt: item.createdAt,
    }),
    buildPayload: (values) => ({
        question: values.primary,
        answer: values.secondary,
        position: values.position,
        isActive: values.isActive,
    }),
};

export function FaqManager(): React.JSX.Element {
    return <ContentManager config={config} />;
}
