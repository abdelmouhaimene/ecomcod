'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { AdminRole, type CreateAdminCommentPayload, type PublicComment } from '@repo/types';
import { AdminApiError, adminApi, resolveMediaUrl } from '../../lib/admin-api';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

interface CommentFormState {
    username: string;
    userImage: string | null;
    content: string;
    rating: string;
}

const emptyForm: CommentFormState = { username: '', userImage: null, content: '', rating: '5' };

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

function initials(username: string): string {
    return username.trim().slice(0, 2).toUpperCase() || '?';
}

export function CommentManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [comments, setComments] = useState<PublicComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [form, setForm] = useState<CommentFormState>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadComments = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            setComments(await adminApi.listComments());
        } catch (caught) {
            setListError(apiMessage(caught, t('createCommentError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadComments();
    }, [loadComments]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setFormError(null);
        setNotice(null);
        setUploadingImage(true);
        try {
            const response = await adminApi.uploadImage(file);
            setForm((current) => ({ ...current, userImage: response.url }));
        } catch (caught) {
            setFormError(apiMessage(caught, t('commentImageError')));
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        const username = form.username.trim();
        const content = form.content.trim();
        if (!username) {
            setFormError(t('commentAuthorRequired'));
            return;
        }
        if (!content) {
            setFormError(t('commentContentRequired'));
            return;
        }

        const payload: CreateAdminCommentPayload = {
            username,
            userImage: form.userImage,
            content,
            rating: Number(form.rating),
        };
        setSaving(true);
        try {
            await adminApi.createComment(payload);
            setForm(emptyForm);
            setNotice(t('commentCreated'));
            await loadComments();
        } catch (caught) {
            setFormError(apiMessage(caught, t('createCommentError')));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (comment: PublicComment) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(comment.id);
        try {
            await adminApi.removeComment(comment.id);
            setComments((current) => current.filter((item) => item.id !== comment.id));
            setConfirmId(null);
            setNotice(t('commentDeleted'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteCommentError')));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('commentsTitle')}</h2>
                    <p className="page-subtitle">{t('commentsSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadComments()}
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
                <section className="section-card narrow" aria-labelledby="comment-form-title">
                    <h3 className="section-title" id="comment-form-title">
                        {t('createComment')}
                    </h3>
                    <p className="section-description">{t('commentsSubtitle')}</p>

                    <div className="form-stack compact">
                        <div className="field">
                            <label className="field-label" htmlFor="comment-username">
                                {t('commentUsername')}
                            </label>
                            <input
                                id="comment-username"
                                className="field-input"
                                value={form.username}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, username: event.target.value }))
                                }
                                autoComplete="off"
                            />
                        </div>

                        <div className="field">
                            <span className="field-label">{t('commentUserImage')}</span>
                            <p className="field-hint">{t('commentUserImageHint')}</p>
                            <div className="image-card-controls">
                                <label className="button secondary small" htmlFor="comment-image-file">
                                    {uploadingImage ? t('uploading') : t('uploadUserImage')}
                                </label>
                                <input
                                    id="comment-image-file"
                                    className="sr-only"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    aria-label={t('uploadUserImage')}
                                    disabled={uploadingImage || saving}
                                    onChange={(event) => void handleImageChange(event)}
                                />
                                {form.userImage ? (
                                    <button
                                        type="button"
                                        className="button secondary small"
                                        onClick={() =>
                                            setForm((current) => ({ ...current, userImage: null }))
                                        }
                                    >
                                        {t('removeUserImage')}
                                    </button>
                                ) : null}
                            </div>
                            <div className="avatar-preview">
                                {form.userImage ? (
                                    <img
                                        className="image-thumb"
                                        src={resolveMediaUrl(form.userImage)}
                                        alt=""
                                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '50%' }}
                                    />
                                ) : (
                                    <span className="avatar-fallback">
                                        {initials(form.username || '?')}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="comment-content">
                                {t('commentContent')}
                            </label>
                            <textarea
                                id="comment-content"
                                className="field-input"
                                rows={4}
                                maxLength={1000}
                                value={form.content}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, content: event.target.value }))
                                }
                            />
                        </div>

                        <div className="field">
                            <label className="field-label" htmlFor="comment-rating">
                                {t('commentRating')}
                            </label>
                            <select
                                id="comment-rating"
                                className="field-input"
                                value={form.rating}
                                onChange={(event) =>
                                    setForm((current) => ({ ...current, rating: event.target.value }))
                                }
                            >
                                {[1, 2, 3, 4, 5].map((rating) => (
                                    <option key={rating} value={rating}>
                                        {rating} / 5
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void handleSave()}
                                disabled={saving || uploadingImage}
                            >
                                {saving ? t('saving') : t('save')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className="section-card table-card" aria-labelledby="comment-list-title">
                <h3 className="section-title" id="comment-list-title">
                    {t('commentsTitle')}
                </h3>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('commentsLoading')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadComments()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('commentsEmpty')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('commentUsername')}</th>
                                    <th scope="col">{t('commentContent')}</th>
                                    <th scope="col">{t('commentRating')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {comments.map((comment) => (
                                    <tr key={comment.id}>
                                        <td>
                                            <div className="comment-author-cell">
                                                {comment.userImage ? (
                                                    <img
                                                        className="image-thumb"
                                                        src={resolveMediaUrl(comment.userImage)}
                                                        alt=""
                                                        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }}
                                                    />
                                                ) : (
                                                    <span className="avatar-fallback">
                                                        {initials(comment.username)}
                                                    </span>
                                                )}
                                                <div>
                                                    <strong>{comment.username}</strong>
                                                    <span className="muted">
                                                        {comment.source === 'ADMIN'
                                                            ? t('commentSourceAdmin')
                                                            : t('commentSourceUser')}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="comment-content-cell">{comment.content}</td>
                                        <td>{comment.rating} / 5</td>
                                        <td className="muted">{formatDate(comment.createdAt)}</td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === comment.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t('confirmDeleteComment')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(comment)}
                                                            disabled={deletingId === comment.id}
                                                        >
                                                            {deletingId === comment.id
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
                                                        onClick={() => setConfirmId(comment.id)}
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
