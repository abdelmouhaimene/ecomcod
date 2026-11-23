'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
    AdminRole,
    SOCIAL_PLATFORMS,
    type PublicStoreInfo,
    type SocialPlatform,
    type StoreInfoPayload,
} from '@repo/types';
import { AdminApiError, adminApi, resolveMediaUrl } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
    tiktok: 'TikTok',
    youtube: 'YouTube',
    instagram: 'Instagram',
    x: 'X',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    ouedkniss: 'Ouedkniss',
};

interface SocialField {
    enabled: boolean;
    url: string;
}

interface StoreForm {
    name: string;
    description: string;
    logo: string;
    email: string;
    website: string;
    address: string;
    mapQuery: string;
    phones: string[];
    social: Record<SocialPlatform, SocialField>;
}

function emptySocial(): Record<SocialPlatform, SocialField> {
    return Object.fromEntries(
        SOCIAL_PLATFORMS.map((platform) => [platform, { enabled: false, url: '' }])
    ) as Record<SocialPlatform, SocialField>;
}

function formFromStore(info: PublicStoreInfo): StoreForm {
    const social = emptySocial();
    info.socialLinks.forEach((link) => {
        social[link.platform] = { enabled: true, url: link.url };
    });
    return {
        name: info.name,
        description: info.description,
        logo: info.logo,
        email: info.email,
        website: info.website,
        address: info.address,
        mapQuery: info.mapQuery,
        phones: info.phones.map((phone) => phone.number),
        social,
    };
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

function isValidUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export function StoreManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { t } = useDashboard();
    const canManage = admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [store, setStore] = useState<PublicStoreInfo | null>(null);
    const [form, setForm] = useState<StoreForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const loadStore = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const info = await adminApi.getStore();
            setStore(info);
            setForm(formFromStore(info));
        } catch (caught) {
            setLoadError(apiMessage(caught, t('storeLoadError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadStore();
    }, [loadStore]);

    const setField = <K extends keyof StoreForm>(field: K, value: StoreForm[K]) => {
        setForm((current) => (current ? { ...current, [field]: value } : current));
    };

    const setSocialField = (platform: SocialPlatform, patch: Partial<SocialField>) => {
        setForm((current) =>
            current
                ? {
                      ...current,
                      social: {
                          ...current.social,
                          [platform]: { ...current.social[platform], ...patch },
                      },
                  }
                : current,
        );
    };

    const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setFormError(null);
        setNotice(null);
        setUploadingLogo(true);
        try {
            const response = await adminApi.uploadImage(file);
            setField('logo', response.url);
        } catch (caught) {
            setFormError(apiMessage(caught, t('galleryImageError')));
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSave = async () => {
        if (!form) return;
        setFormError(null);
        setNotice(null);

        const name = form.name.trim();
        const email = form.email.trim();
        const phones = form.phones.map((phone) => phone.trim()).filter(Boolean);
        const socialLinks = SOCIAL_PLATFORMS.filter(
            (platform) => form.social[platform].enabled
        ).map((platform) => ({ platform, url: form.social[platform].url.trim() }));

        if (!name) {
            setFormError(t('storeNameRequired'));
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFormError(t('storeEmailRequired'));
            return;
        }
        if (socialLinks.some((link) => !isValidUrl(link.url))) {
            setFormError(t('storeSocialUrlRequired'));
            return;
        }

        const payload: StoreInfoPayload = {
            name,
            description: form.description.trim(),
            logo: form.logo.trim(),
            email,
            website: form.website.trim(),
            address: form.address.trim(),
            mapQuery: form.mapQuery.trim(),
            phones,
            socialLinks,
        };

        setSaving(true);
        try {
            const updated = await adminApi.updateStore(payload);
            setStore(updated);
            setForm(formFromStore(updated));
            setNotice(t('storeSaved'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('storeSaveError')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('storeTitle')}</h2>
                    <p className="page-subtitle">{t('storeSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadStore()}
                        disabled={loading}
                    >
                        {t('refresh')}
                    </button>
                </div>
            </header>

            {notice ? (
                <p className="notice success" role="status">
                    {notice}
                </p>
            ) : null}
            {formError ? (
                <p className="notice error" role="alert">
                    {formError}
                </p>
            ) : null}
            {!canManage ? (
                <div className="notice info" role="note">
                    <strong className="notice-title">{t('catalogReadOnlyTitle')}</strong>
                    <span>{t('catalogReadOnlyDescription')}</span>
                </div>
            ) : null}

            {loading ? (
                <div className="center-state">
                    <span className="state-spinner" aria-hidden="true" />
                    <p className="state-text">{t('storeLoading')}</p>
                </div>
            ) : loadError ? (
                <div className="empty-state">
                    <p className="state-text">{loadError}</p>
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadStore()}
                    >
                        {t('retry')}
                    </button>
                </div>
            ) : !form ? null : (
                <>
                    <section className="section-card narrow" aria-labelledby="store-identity-title">
                        <h3 className="section-title" id="store-identity-title">
                            {t('storeIdentity')}
                        </h3>
                        <div className="form-stack compact">
                            <div className="field">
                                <label className="field-label" htmlFor="store-name">
                                    {t('storeName')}
                                </label>
                                <input
                                    id="store-name"
                                    className="field-input"
                                    value={form.name}
                                    disabled={!canManage}
                                    onChange={(event) => setField('name', event.target.value)}
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="store-description">
                                    {t('storeDescription')}
                                </label>
                                <textarea
                                    id="store-description"
                                    className="field-input"
                                    rows={4}
                                    value={form.description}
                                    disabled={!canManage}
                                    onChange={(event) => setField('description', event.target.value)}
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="store-logo">
                                    {t('storeLogo')}
                                </label>
                                <p className="field-hint">{t('storeLogoHint')}</p>
                                <input
                                    id="store-logo"
                                    className="field-input"
                                    value={form.logo}
                                    disabled={!canManage}
                                    onChange={(event) => setField('logo', event.target.value)}
                                    placeholder="/uploads/logo.png"
                                />
                                {canManage ? (
                                    <div className="image-card-controls">
                                        <label className="button secondary small" htmlFor="store-logo-file">
                                            {uploadingLogo ? t('uploading') : t('uploadStoreLogo')}
                                        </label>
                                        <input
                                            id="store-logo-file"
                                            className="sr-only"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                            aria-label={t('uploadStoreLogo')}
                                            disabled={uploadingLogo || saving}
                                            onChange={(event) => void handleLogoUpload(event)}
                                        />
                                    </div>
                                ) : null}
                                {form.logo ? (
                                    <div className="avatar-preview">
                                        <img
                                            className="store-logo-preview"
                                            src={resolveMediaUrl(form.logo)}
                                            alt=""
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </section>

                    <section className="section-card narrow" aria-labelledby="store-contact-title">
                        <h3 className="section-title" id="store-contact-title">
                            {t('storeContact')}
                        </h3>
                        <div className="form-stack compact">
                            <div className="field-grid">
                                <div className="field">
                                    <label className="field-label" htmlFor="store-email">
                                        {t('storeEmail')}
                                    </label>
                                    <input
                                        id="store-email"
                                        className="field-input"
                                        type="email"
                                        value={form.email}
                                        disabled={!canManage}
                                        onChange={(event) => setField('email', event.target.value)}
                                    />
                                </div>
                                <div className="field">
                                    <label className="field-label" htmlFor="store-website">
                                        {t('storeWebsite')}
                                    </label>
                                    <input
                                        id="store-website"
                                        className="field-input"
                                        value={form.website}
                                        disabled={!canManage}
                                        onChange={(event) => setField('website', event.target.value)}
                                        placeholder="https://example.com"
                                    />
                                </div>
                            </div>

                            <div className="field">
                                <span className="field-label">{t('storePhones')}</span>
                                <div className="store-phone-list">
                                    {form.phones.map((phone, index) => (
                                        <div className="store-phone-row" key={index}>
                                            <input
                                                className="field-input"
                                                type="tel"
                                                aria-label={`${t('storePhone')} ${index + 1}`}
                                                value={phone}
                                                disabled={!canManage}
                                                onChange={(event) =>
                                                    setField(
                                                        'phones',
                                                        form.phones.map((item, itemIndex) =>
                                                            itemIndex === index ? event.target.value : item
                                                        )
                                                    )
                                                }
                                            />
                                            {canManage ? (
                                                <button
                                                    type="button"
                                                    className="button danger small"
                                                    aria-label={`${t('removePhone')} ${index + 1}`}
                                                    onClick={() =>
                                                        setField(
                                                            'phones',
                                                            form.phones.filter((_, itemIndex) => itemIndex !== index)
                                                        )
                                                    }
                                                >
                                                    {t('removePhone')}
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                                {canManage ? (
                                    <div className="image-card-controls">
                                        <button
                                            type="button"
                                            className="button secondary small"
                                            onClick={() => setField('phones', [...form.phones, ''])}
                                        >
                                            {t('addPhone')}
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="field">
                                <label className="field-label" htmlFor="store-address">
                                    {t('storeAddress')}
                                </label>
                                <input
                                    id="store-address"
                                    className="field-input"
                                    value={form.address}
                                    disabled={!canManage}
                                    onChange={(event) => setField('address', event.target.value)}
                                />
                            </div>

                            <div className="field">
                                <label className="field-label" htmlFor="store-map-query">
                                    {t('storeMapQuery')}
                                </label>
                                <p className="field-hint">{t('storeMapHint')}</p>
                                <input
                                    id="store-map-query"
                                    className="field-input"
                                    value={form.mapQuery}
                                    disabled={!canManage}
                                    onChange={(event) => setField('mapQuery', event.target.value)}
                                    placeholder="36.7538, 3.0588"
                                />
                                {store?.mapEmbedUrl ? (
                                    <>
                                        <iframe
                                            className="store-map-frame"
                                            src={store.mapEmbedUrl}
                                            title={t('storeMapQuery')}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                        />
                                        <a
                                            className="text-link"
                                            href={store.mapLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {t('storeMapLink')}
                                        </a>
                                    </>
                                ) : (
                                    <p className="field-hint">{t('storeMapPreview')}</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="section-card narrow" aria-labelledby="store-social-title">
                        <h3 className="section-title" id="store-social-title">
                            {t('storeSocial')}
                        </h3>
                        <p className="section-description">{t('storeSocialHint')}</p>
                        <div className="store-social-list">
                            {SOCIAL_PLATFORMS.map((platform) => {
                                const field = form.social[platform];
                                return (
                                    <div className="store-social-row" key={platform}>
                                        <label className="store-social-check">
                                            <input
                                                type="checkbox"
                                                checked={field.enabled}
                                                disabled={!canManage}
                                                aria-label={`${t('storeUseSocial')} ${SOCIAL_LABELS[platform]}`}
                                                onChange={(event) =>
                                                    setSocialField(platform, { enabled: event.target.checked })
                                                }
                                            />
                                            <span>{SOCIAL_LABELS[platform]}</span>
                                        </label>
                                        <input
                                            className="field-input"
                                            type="url"
                                            aria-label={`${SOCIAL_LABELS[platform]} ${t('storeSocialUrl')}`}
                                            placeholder="https://"
                                            value={field.url}
                                            disabled={!canManage || !field.enabled}
                                            onChange={(event) =>
                                                setSocialField(platform, { url: event.target.value })
                                            }
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {canManage ? (
                        <div className="form-actions">
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void handleSave()}
                                disabled={saving || uploadingLogo}
                            >
                                {saving ? t('saving') : t('save')}
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </>
    );
}
