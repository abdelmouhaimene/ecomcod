/* eslint-disable @next/next/no-img-element -- product images are uploaded files served as-is */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AdminRole, type ProductPayload, type PublicProduct, type PublicCategory } from '@repo/types';
import { AdminApiError, adminApi, resolveMediaUrl } from '../../lib/admin-api';
import type { TranslationKey } from '../../lib/i18n';
import { useAuth } from '../providers/auth-provider';
import { useDashboard } from '../providers/dashboard-provider';

type Translate = (key: TranslationKey) => string;

interface ImageDraft {
    key: string;
    url: string;
    isMain: boolean;
    position: number;
}

interface VariantDraft {
    key: string;
    name: string;
    value: string;
    price: string;
    imageKey: string;
}

interface ProductFormState {
    ref: string;
    name: string;
    subtitle: string;
    description: string;
    price: string;
    oldPrice: string;
    fakeReviews: string;
    realReviews: string;
    fakeSolds: string;
    realSolds: string;
    categoryIds: string[];
    images: ImageDraft[];
    variants: VariantDraft[];
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

let tempKeyCounter = 0;

function nextTempKey(prefix: string): string {
    tempKeyCounter += 1;
    return `${prefix}-temp-${Date.now()}-${tempKeyCounter}`;
}

function createEmptyForm(): ProductFormState {
    return {
        ref: '',
        name: '',
        subtitle: '',
        description: '',
        price: '',
        oldPrice: '',
        fakeReviews: '0',
        realReviews: '0',
        fakeSolds: '0',
        realSolds: '0',
        categoryIds: [],
        images: [],
        variants: [],
    };
}

function productToForm(product: PublicProduct): ProductFormState {
    return {
        ref: product.ref,
        name: product.name,
        subtitle: product.subtitle ?? '',
        description: product.description ?? '',
        price: String(product.price),
        oldPrice: product.oldPrice === null ? '' : String(product.oldPrice),
        fakeReviews: String(product.fakeReviews),
        realReviews: String(product.realReviews),
        fakeSolds: String(product.fakeSolds),
        realSolds: String(product.realSolds),
        categoryIds: product.categories.map((category) => category.id),
        images: product.images.map((image) => ({
            key: image.id,
            url: image.url,
            isMain: image.isMain,
            position: image.position,
        })),
        variants: product.variants.map((variant) => ({
            key: variant.id,
            name: variant.name,
            value: variant.value,
            price: String(variant.price),
            imageKey: variant.imageKey || variant.imageId,
        })),
    };
}

function isNonNegativeInteger(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

function isNonNegativeNumber(value: string): boolean {
    if (value.trim() === '') return false;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
}

/** Ratings are 0..5 with at most one decimal place. */
function isRating(value: string): boolean {
    if (value.trim() === '') return false;
    const parsed = Number(value);
    return (
        Number.isFinite(parsed) &&
        parsed >= 0 &&
        parsed <= 5 &&
        Math.abs(parsed * 10 - Math.round(parsed * 10)) < 1e-9
    );
}

/** All values are validated before this runs; keys stay client-stable. */
function buildPayload(form: ProductFormState): ProductPayload {
    const mainIndex = form.images.findIndex((image) => image.isMain);
    const effectiveMain = mainIndex === -1 ? 0 : mainIndex;

    return {
        ref: form.ref.trim(),
        name: form.name.trim(),
        subtitle: form.subtitle.trim() === '' ? null : form.subtitle.trim(),
        description: form.description.trim() === '' ? null : form.description.trim(),
        price: Number(form.price),
        oldPrice: form.oldPrice.trim() === '' ? null : Number(form.oldPrice),
        fakeReviews: Number(form.fakeReviews),
        realReviews: Number(form.realReviews),
        fakeSolds: Number(form.fakeSolds),
        realSolds: Number(form.realSolds),
        categoryIds: form.categoryIds,
        images: form.images.map((image, index) => ({
            key: image.key,
            url: image.url,
            isMain: index === effectiveMain,
            position: Number(image.position),
        })),
        variants: form.variants.map((variant) => ({
            key: variant.key,
            name: variant.name.trim(),
            value: variant.value.trim(),
            price: Number(variant.price),
            imageKey: variant.imageKey,
        })),
    };
}

interface ImageCardProps {
    image: ImageDraft;
    t: Translate;
    onMain: (key: string) => void;
    onPositionChange: (key: string, value: string) => void;
    onRemove: (key: string) => void;
}

function ImageCard({
    image,
    t,
    onMain,
    onPositionChange,
    onRemove,
}: ImageCardProps): React.JSX.Element {
    return (
        <article className={image.isMain ? 'image-card image-card-main' : 'image-card'}>
            <img className="image-thumb" src={resolveMediaUrl(image.url)} alt="" loading="lazy" />
            <label className="image-main-label">
                <input
                    type="radio"
                    name="product-main-image"
                    checked={image.isMain}
                    onChange={() => onMain(image.key)}
                />
                {t('mainImage')}
            </label>
            <div className="image-card-controls">
                <label className="field-label" htmlFor={`image-position-${image.key}`}>
                    {t('position')}
                </label>
                <input
                    id={`image-position-${image.key}`}
                    className="field-input field-number"
                    type="number"
                    min="0"
                    value={image.position}
                    onChange={(event) => onPositionChange(image.key, event.target.value)}
                />
            </div>
            {image.isMain ? <span className="badge active">{t('mainImageBadge')}</span> : null}
            <button
                type="button"
                className="button danger small"
                onClick={() => onRemove(image.key)}
            >
                {t('removeImage')}
            </button>
        </article>
    );
}

interface VariantRowProps {
    variant: VariantDraft;
    images: ImageDraft[];
    t: Translate;
    onChange: (key: string, changes: Partial<VariantDraft>) => void;
    onRemove: (key: string) => void;
}

function VariantRow({
    variant,
    images,
    t,
    onChange,
    onRemove,
}: VariantRowProps): React.JSX.Element {
    const orderedImages = [...images].sort(
        (a, b) => a.position - b.position || a.key.localeCompare(b.key),
    );

    return (
        <div className="variant-row">
            <div className="field">
                <label className="field-label" htmlFor={`variant-name-${variant.key}`}>
                    {t('variantName')}
                </label>
                <input
                    id={`variant-name-${variant.key}`}
                    className="field-input"
                    value={variant.name}
                    onChange={(event) => onChange(variant.key, { name: event.target.value })}
                />
            </div>
            <div className="field">
                <label className="field-label" htmlFor={`variant-value-${variant.key}`}>
                    {t('variantValue')}
                </label>
                <input
                    id={`variant-value-${variant.key}`}
                    className="field-input"
                    value={variant.value}
                    onChange={(event) => onChange(variant.key, { value: event.target.value })}
                />
            </div>
            <div className="field">
                <label className="field-label" htmlFor={`variant-price-${variant.key}`}>
                    {t('variantPrice')}
                </label>
                <input
                    id={`variant-price-${variant.key}`}
                    className="field-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.price}
                    onChange={(event) => onChange(variant.key, { price: event.target.value })}
                />
            </div>
            <div className="field">
                <label className="field-label" htmlFor={`variant-image-${variant.key}`}>
                    {t('variantImage')}
                </label>
                <select
                    id={`variant-image-${variant.key}`}
                    className="field-input"
                    value={variant.imageKey}
                    onChange={(event) => onChange(variant.key, { imageKey: event.target.value })}
                >
                    <option value="">{t('selectImage')}</option>
                    {orderedImages.map((image, index) => (
                        <option key={image.key} value={image.key}>
                            {`${t('imageNumber')} ${index + 1}`}
                        </option>
                    ))}
                </select>
            </div>
            <div className="variant-actions">
                <button
                    type="button"
                    className="button danger small"
                    onClick={() => onRemove(variant.key)}
                >
                    {t('removeVariant')}
                </button>
            </div>
        </div>
    );
}

export function ProductManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [products, setProducts] = useState<PublicProduct[]>([]);
    const [categories, setCategories] = useState<PublicCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<ProductFormState>(createEmptyForm);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadCatalog = useCallback(async () => {
        setLoading(true);
        setListError(null);
        try {
            const [productList, categoryList] = await Promise.all([
                adminApi.listProducts(),
                adminApi.listCategories(),
            ]);
            setProducts(productList);
            setCategories(categoryList);
        } catch (caught) {
            setListError(apiMessage(caught, t('loadProductsError')));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void loadCatalog();
    }, [loadCatalog]);

    const filteredProducts = useMemo(() => {
        const query = search.trim().toLowerCase();
        return products.filter((product) => {
            const matchesCategory =
                categoryFilter === '' ||
                product.categories.some((category) => category.id === categoryFilter);
            const matchesQuery =
                query === '' ||
                [product.ref, product.name, product.subtitle ?? ''].some((value) =>
                    value.toLowerCase().includes(query),
                );
            return matchesCategory && matchesQuery;
        });
    }, [products, search, categoryFilter]);

    const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    const numberFormatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    const resetForm = () => {
        setEditingId(null);
        setForm(createEmptyForm());
        setFormError(null);
        setFormOpen(false);
    };

    const openCreateForm = () => {
        if (formOpen && editingId === null) {
            resetForm();
            return;
        }
        setNotice(null);
        setFormError(null);
        setEditingId(null);
        setForm(createEmptyForm());
        setFormOpen(true);
    };

    const startEdit = (product: PublicProduct) => {
        setNotice(null);
        setFormError(null);
        setEditingId(product.id);
        setForm(productToForm(product));
        setFormOpen(true);
    };

    const toggleCategory = (id: string) => {
        setForm((current) => ({
            ...current,
            categoryIds: current.categoryIds.includes(id)
                ? current.categoryIds.filter((value) => value !== id)
                : [...current.categoryIds, id],
        }));
    };

    const setMainImage = (key: string) => {
        setForm((current) => ({
            ...current,
            images: current.images.map((image) => ({ ...image, isMain: image.key === key })),
        }));
    };

    const changeImagePosition = (key: string, value: string) => {
        setForm((current) => ({
            ...current,
            images: current.images.map((image) =>
                image.key === key ? { ...image, position: Number(value) } : image,
            ),
        }));
    };

    const removeImage = (key: string) => {
        setForm((current) => {
            const remaining = current.images.filter((image) => image.key !== key);
            const hasMain = remaining.some((image) => image.isMain);
            const images = hasMain
                ? remaining
                : remaining.map((image, index) => (index === 0 ? { ...image, isMain: true } : image));
            return {
                ...current,
                images,
                variants: current.variants.map((variant) =>
                    variant.imageKey === key ? { ...variant, imageKey: '' } : variant,
                ),
            };
        });
    };

    const addVariant = () => {
        setForm((current) => ({
            ...current,
            variants: [
                ...current.variants,
                {
                    key: nextTempKey('variant'),
                    name: '',
                    value: '',
                    price: '',
                    imageKey: '',
                },
            ],
        }));
    };

    const changeVariant = (key: string, changes: Partial<VariantDraft>) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.map((variant) =>
                variant.key === key ? { ...variant, ...changes } : variant,
            ),
        }));
    };

    const removeVariant = (key: string) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.filter((variant) => variant.key !== key),
        }));
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setFormError(null);
        setUploading(true);
        try {
            const response = await adminApi.uploadImage(file);
            setForm((current) => {
                const hasMain = current.images.some((image) => image.isMain);
                return {
                    ...current,
                    images: [
                        ...current.images,
                        {
                            key: nextTempKey('image'),
                            url: response.url,
                            isMain: !hasMain,
                            position: current.images.length,
                        },
                    ],
                };
            });
            setNotice(t('imageUploaded'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('uploadImageError')));
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setFormError(null);
        setNotice(null);

        if (form.ref.trim() === '') {
            setFormError(t('refRequired'));
            return;
        }
        if (form.name.trim() === '') {
            setFormError(t('nameRequired'));
            return;
        }
        if (!isNonNegativeNumber(form.price)) {
            setFormError(t('priceInvalid'));
            return;
        }
        if (form.oldPrice.trim() !== '' && !isNonNegativeNumber(form.oldPrice)) {
            setFormError(t('oldPriceInvalid'));
            return;
        }
        const counts = [
            form.fakeSolds,
            form.realSolds,
            ...form.images.map((image) => String(image.position)),
        ];
        if (counts.some((value) => !isNonNegativeInteger(value))) {
            setFormError(t('countInvalid'));
            return;
        }
        if (!isRating(form.fakeReviews)) {
            setFormError(t('ratingInvalid'));
            return;
        }
        if (form.categoryIds.length === 0) {
            setFormError(t('categoryRequired'));
            return;
        }
        if (form.images.length === 0) {
            setFormError(t('imageRequired'));
            return;
        }
        for (const variant of form.variants) {
            if (variant.name.trim() === '' || variant.value.trim() === '') {
                setFormError(t('required'));
                return;
            }
            if (!isNonNegativeNumber(variant.price)) {
                setFormError(t('priceInvalid'));
                return;
            }
            if (!form.images.some((image) => image.key === variant.imageKey)) {
                setFormError(t('variantImageRequired'));
                return;
            }
        }

        const payload = buildPayload(form);
        setSaving(true);
        try {
            if (editingId !== null) {
                await adminApi.updateProduct(editingId, payload);
                setNotice(t('productUpdated'));
            } else {
                await adminApi.createProduct(payload);
                setNotice(t('productCreated'));
            }
            resetForm();
            await loadCatalog();
        } catch (caught) {
            setFormError(
                apiMessage(caught, t(editingId === null ? 'createProductError' : 'updateProductError')),
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (product: PublicProduct) => {
        setFormError(null);
        setNotice(null);
        setDeletingId(product.id);
        try {
            await adminApi.removeProduct(product.id);
            setProducts((current) => current.filter((item) => item.id !== product.id));
            if (editingId === product.id) resetForm();
            setConfirmId(null);
            setNotice(t('productDeleted'));
        } catch (caught) {
            setFormError(apiMessage(caught, t('deleteProductError')));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <header className="page-heading toolbar">
                <div>
                    <h2 className="page-title">{t('productsTitle')}</h2>
                    <p className="page-subtitle">{t('productsSubtitle')}</p>
                </div>
                <div className="toolbar-actions">
                    {canManage ? (
                        <button
                            type="button"
                            className="button primary small"
                            onClick={openCreateForm}
                            aria-expanded={formOpen}
                            aria-controls="product-form"
                        >
                            {t('createProduct')}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="button secondary small"
                        onClick={() => void loadCatalog()}
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

            <section className="section-card table-card" aria-label={t('productsTitle')}>
                <div className="table-toolbar">
                    <input
                        type="search"
                        className="field-input search-input"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('searchProducts')}
                        aria-label={t('searchProducts')}
                    />
                    <label className="sr-only" htmlFor="product-category-filter">
                        {t('columnCategories')}
                    </label>
                    <select
                        id="product-category-filter"
                        className="field-input filter-select"
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        aria-label={t('columnCategories')}
                    >
                        <option value="">{t('categoryFilter')}</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                    <span className="stat-note">
                        {t('showingProducts')} {filteredProducts.length} / {products.length}
                    </span>
                </div>

                {loading ? (
                    <div className="center-state">
                        <span className="state-spinner" aria-hidden="true" />
                        <p className="state-text">{t('loadingProducts')}</p>
                    </div>
                ) : listError ? (
                    <div className="empty-state">
                        <p className="state-text">{listError}</p>
                        <button
                            type="button"
                            className="button secondary small"
                            onClick={() => void loadCatalog()}
                        >
                            {t('retry')}
                        </button>
                    </div>
                ) : products.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('productsEmpty')}</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="empty-state">
                        <p className="state-text">{t('noProductResults')}</p>
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('columnRef')}</th>
                                    <th scope="col">{t('productColumn')}</th>
                                    <th scope="col">{t('columnPrice')}</th>
                                    <th scope="col">{t('columnCategories')}</th>
                                    <th scope="col">{t('columnImages')}</th>
                                    <th scope="col">{t('columnVariants')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                    {canManage ? <th scope="col">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product) => (
                                    <tr key={product.id}>
                                        <td>
                                            <strong>{product.ref}</strong>
                                        </td>
                                        <td>
                                            <span className="client-primary">{product.name}</span>
                                            {product.subtitle ? (
                                                <span className="client-secondary">
                                                    {product.subtitle}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td>{numberFormatter.format(product.price)}</td>
                                        <td className="muted">
                                            {product.categories.length === 0
                                                ? '—'
                                                : product.categories
                                                      .map((category) => category.name)
                                                      .join(', ')}
                                        </td>
                                        <td className="muted">{product.images.length}</td>
                                        <td className="muted">{product.variants.length}</td>
                                        <td className="muted">{formatDate(product.createdAt)}</td>
                                        {canManage ? (
                                            <td>
                                                {confirmId === product.id ? (
                                                    <div className="inline-confirm">
                                                        <span className="confirm-text">
                                                            {t('confirmDeleteProduct')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => void handleDelete(product)}
                                                            disabled={deletingId === product.id}
                                                        >
                                                            {deletingId === product.id
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
                                                    <div className="inline-confirm">
                                                        <button
                                                            type="button"
                                                            className="button secondary small"
                                                            onClick={() => startEdit(product)}
                                                        >
                                                            {t('edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button danger small"
                                                            onClick={() => setConfirmId(product.id)}
                                                        >
                                                            {t('delete')}
                                                        </button>
                                                    </div>
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

            {canManage && formOpen ? (
                <section id="product-form" className="section-card product-form" aria-labelledby="product-form-title">
                    <h3 className="section-title" id="product-form-title">
                        {editingId === null ? t('createProduct') : t('editProduct')}
                    </h3>
                    <p className="section-description">{t('productsSubtitle')}</p>

                    <div className="form-stack compact">
                        <div className="field-grid">
                            <div className="field">
                                <label className="field-label" htmlFor="product-ref">
                                    {t('ref')}
                                </label>
                                <input
                                    id="product-ref"
                                    className="field-input"
                                    value={form.ref}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            ref: event.target.value,
                                        }))
                                    }
                                    autoComplete="off"
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="product-name">
                                    {t('name')}
                                </label>
                                <input
                                    id="product-name"
                                    className="field-input"
                                    value={form.name}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            name: event.target.value,
                                        }))
                                    }
                                    autoComplete="off"
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="product-subtitle">
                                    {t('subtitle')}
                                </label>
                                <input
                                    id="product-subtitle"
                                    className="field-input"
                                    value={form.subtitle}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            subtitle: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="product-description">
                                    {t('description')}
                                </label>
                                <textarea
                                    id="product-description"
                                    className="field-input"
                                    rows={3}
                                    value={form.description}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            description: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="product-price">
                                    {t('price')}
                                </label>
                                <input
                                    id="product-price"
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.price}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            price: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="product-old-price">
                                    {t('oldPrice')}
                                </label>
                                <input
                                    id="product-old-price"
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.oldPrice}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            oldPrice: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="product-fake-reviews">
                                    {t('fakeReviews')}
                                </label>
                                <input
                                    id="product-fake-reviews"
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    max="5"
                                    step="0.1"
                                    value={form.fakeReviews}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            fakeReviews: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="field">
                                <label className="field-label" htmlFor="product-fake-solds">
                                    {t('fakeSolds')}
                                </label>
                                <input
                                    id="product-fake-solds"
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    value={form.fakeSolds}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            fakeSolds: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                        <p className="field-hint">{t('realMetricsHint')}</p>

                        <div className="field">
                            <span className="field-label">{t('categoriesLabel')}</span>
                            <p className="field-hint">{t('categoriesHint')}</p>
                            <div className="chip-select">
                                {categories.map((category) => {
                                    const selected = form.categoryIds.includes(category.id);
                                    return (
                                        <label
                                            key={category.id}
                                            className={selected ? 'chip selected' : 'chip'}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => toggleCategory(category.id)}
                                            />
                                            <span>{category.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="field">
                            <span className="field-label">{t('imagesLabel')}</span>
                            <p className="field-hint">{t('imagesHint')}</p>
                            <div className="image-card-controls">
                                <label className="button secondary small" htmlFor="product-image-file">
                                    {uploading ? t('uploading') : t('uploadImage')}
                                </label>
                                <input
                                    id="product-image-file"
                                    className="sr-only"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    aria-label={t('imageFileLabel')}
                                    onChange={(event) => void handleFileChange(event)}
                                />
                                <span className="field-hint">{t('uploadHint')}</span>
                            </div>
                            {form.images.length === 0 ? (
                                <p className="state-text">{t('noImages')}</p>
                            ) : (
                                <div className="image-grid">
                                    {form.images.map((image) => (
                                        <ImageCard
                                            key={image.key}
                                            image={image}
                                            t={t}
                                            onMain={setMainImage}
                                            onPositionChange={changeImagePosition}
                                            onRemove={removeImage}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="field">
                            <div className="image-card-controls">
                                <span className="field-label">{t('variantsLabel')}</span>
                                <button
                                    type="button"
                                    className="button secondary small"
                                    onClick={addVariant}
                                >
                                    {t('addVariant')}
                                </button>
                            </div>
                            <p className="field-hint">{t('variantsHint')}</p>
                            {form.variants.length === 0 ? (
                                <p className="state-text">{t('noVariants')}</p>
                            ) : (
                                <div className="variant-list">
                                    {form.variants.map((variant) => (
                                        <VariantRow
                                            key={variant.key}
                                            variant={variant}
                                            images={form.images}
                                            t={t}
                                            onChange={changeVariant}
                                            onRemove={removeVariant}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-actions">
                            <button type="button" className="button secondary" onClick={resetForm}>
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                className="button primary"
                                onClick={() => void handleSave()}
                                disabled={saving || uploading}
                            >
                                {saving ? t('saving') : t('save')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}
        </>
    );
}
