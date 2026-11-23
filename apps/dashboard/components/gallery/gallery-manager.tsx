'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
    AdminRole,
    type GalleryPhotoPayload,
    type GalleryState,
    type PublicGalleryPhoto,
} from '@repo/types';
import { AdminApiError, adminApi, resolveMediaUrl } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface GalleryFormState {
    image: string;
    name: string;
    date: string;
    location: string;
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyForm(): GalleryFormState {
    return { image: '', name: '', date: today(), location: '' };
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

export function GalleryManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [gallery, setGallery] = useState<GalleryState | null>(null);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [form, setForm] = useState<GalleryFormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadGallery = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setGallery(await adminApi.getGallery());
        } catch (caught) {
            setListError(apiMessage(caught, t('statusGalleryError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadGallery();
    }, [loadGallery]);

    const formatDate = (value: string): string =>
        new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeZone: 'UTC',
        }).format(new Date(`${value}T00:00:00Z`));

    const handleToggle = async () => {
        if (!gallery || !canManage) return;
        setFormError(null);
        setNotice(null);
        setToggling(true);
        try {
            const updated = await adminApi.setGalleryStatus({ isActive: !gallery.isActive });
            setGallery(updated);
            setNotice(t('galleryStatusUpdated'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('statusGalleryError')));
        } finally {
            setToggling(false);
        }
    };

    const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setFormError(null);
        setNotice(null);
        setUploadingImage(true);
        try {
            const response = await adminApi.uploadImage(file);
            setForm((current) => ({ ...current, image: response.url }));
        } catch (caught) {
            setFormError(apiMessage(caught, t('galleryImageError')));
        } finally {
            setUploadingImage(false);
        }
    };

    const handleCreate = async () => {
        setFormError(null);
        setNotice(null);

        const payload: GalleryPhotoPayload = {
            image: form.image.trim(),
            name: form.name.trim(),
            date: form.date,
            location: form.location.trim(),
        };
        if (!payload.image) {
            setFormError(t('galleryImageRequired'));
            return;
        }
        if (!payload.name) {
            setFormError(t('galleryNameRequired'));
            return;
        }
        if (!payload.date) {
            setFormError(t('galleryDateRequired'));
            return;
        }
        if (!payload.location) {
            setFormError(t('galleryLocationRequired'));
            return;
        }

        setSaving(true);
        try {
            await adminApi.createGalleryPhoto(payload);
            setForm(emptyForm());
            setNotice(t('galleryCreated'));
            await loadGallery();
        } catch (caught) {
            setFormError(apiMessage(caught, t('createGalleryError')));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (photo: PublicGalleryPhoto) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(photo.id);
        try {
            await adminApi.removeGalleryPhoto(photo.id);
            setGallery((current) =>
                current
                    ? { ...current, photos: current.photos.filter((item) => item.id !== photo.id) }
                    : current,
            );
            setConfirmId(null);
            setNotice(t('galleryDeleted'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteGalleryError')));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('galleryTitle')}</h2>
                    <p className="page-subtitle">{t('gallerySubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadGallery()}
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

            {canManage ? (
                <section className="section-card narrow" aria-labelledby="gallery-settings-title">
                    <h3 className="section-title" id="gallery-settings-title">
                        {t('galleryVisibility')}
                    </h3>
                    <p className="section-description">{t('galleryVisibilityHint')}</p>
                    <div className="gallery-visibility-row">
                        <span className={`badge ${gallery?.isActive ? 'active' : 'inactive'}`}>
                            {gallery?.isActive ? t('galleryActive') : t('galleryInactive')}
                        </span>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void handleToggle()}
                            disabled={toggling || !gallery}
                        >
                            {toggling
                                ? t('saving')
                                : gallery?.isActive
                                  ? t('galleryInactive')
                                  : t('galleryActive')}
                        </button>
                    </div>
                </section>
            ) : null}

            {canManage ? (
                <section className="section-card narrow" aria-labelledby="gallery-form-title">
                    <h3 className="section-title" id="gallery-form-title">
                        {t('addGalleryPhoto')}
                    </h3>
                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="gallery-name">
                                {t('galleryName')}
                            </label>
                            <input
                                id="gallery-name"
                                className="field-input"
                                value={form.name}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, name: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="gallery-image">
                                {t('galleryImage')}
                            </label>
                            <p className="field-hint">{t('galleryImageHint')}</p>
                            <input
                                id="gallery-image"
                                className="field-input"
                                value={form.image}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, image: event.target.value }))
                                }
                                placeholder="/uploads/gallery.jpg"
                            />
                            <div className="image-card-controls">
                                <label className="button secondary small" htmlFor="gallery-image-file">
                                    {uploadingImage ? t('uploading') : t('uploadGalleryImage')}
                                </label>
                                <input
                                    id="gallery-image-file"
                                    className="sr-only"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    aria-label={t('uploadGalleryImage')}
                                    disabled={uploadingImage || saving}
                                    onChange={(event) => void handleImageChange(event)}
                                />
                            </div>
                            {form.image ? (
                                <div className="avatar-preview">
                                    <img
                                        className="gallery-thumb"
                                        src={resolveMediaUrl(form.image)}
                                        alt=""
                                    />
                                </div>
                            ) : null}
                        </div>

                        <div className="form-grid two">
                            <div className="field">
                                <label className="field-label" htmlFor="gallery-date">
                                    {t('galleryDate')}
                                </label>
                                <input
                                    id="gallery-date"
                                    className="field-input"
                                    type="date"
                                    value={form.date}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, date: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="gallery-location">
                                    {t('galleryLocation')}
                                </label>
                                <input
                                    id="gallery-location"
                                    className="field-input"
                                    value={form.location}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            location: event.target.value,
                                        }))
                                    }
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void handleCreate()}
                                disabled={saving || uploadingImage}
                            >
                                {saving ? t('saving') : t('save')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="section-card table-card" aria-labelledby="gallery-list-title">
                <h3 className="section-title" id="gallery-list-title">
                    {t('galleryPhotos')}
                </h3>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('galleryLoading')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadGallery()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : !gallery || gallery.photos.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('galleryEmpty')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('galleryImage')}</th>
                                    <th scope="col">{t('galleryName')}</th>
                                    <th scope="col">{t('galleryDate')}</th>
                                    <th scope="col">{t('galleryLocation')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {gallery.photos.map((photo) => (
                                    <tr key={photo.id}>
                                        <td>
                                            <img
                                                className="gallery-thumb"
                                                src={resolveMediaUrl(photo.image)}
                                                alt=""
                                            />
                                        </td>
                                        <td>{photo.name}</td>
                                        <td className="muted">{formatDate(photo.date)}</td>
                                        <td>{photo.location}</td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === photo.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t('confirmDeleteGalleryPhoto')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(photo)}
                                                            disabled={deletingId === photo.id}
                                                        >
                                                            {deletingId === photo.id
                                                                ? t('deleting')
                                                                : t('delete')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button secondary small"
                                                            onClick={() => setConfirmId(null)}
                                                        >
                                                            {t('cancel')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="button danger small"
                                                        onClick={() => setConfirmId(photo.id)}
                                                    >
                                                        {t('delete')}
                                                    </button>
                                                )}
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    );
}
