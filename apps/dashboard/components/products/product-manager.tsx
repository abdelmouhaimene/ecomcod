/* eslint-disable @next/next/no-img-element -- product images are uploaded files served as-is */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
    AdminRole,
    SIZE_TEXT_VALUES,
    VARIANT_TYPES,
    type ProductPayload,
    type PublicCategory,
    type PublicFamily,
    type PublicProduct,
    type PublicProductSku,
    type VariantType,
} from '@repo/types';
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

interface VariantValueDraft {
    key: string;
    value: string;
    hexColor: string;
    imageKey: string;
}

interface VariantDraft {
    key: string;
    name: string;
    variantType: VariantType;
    values: VariantValueDraft[];
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
    familyIds: string[];
    images: ImageDraft[];
    variants: VariantDraft[];
}

function apiMessage(caught: unknown, fallback: string): string {
    return caught instanceof AdminApiError ? caught.message : fallback;
}

/** Active SKUs are the source of truth for the stock shown in the product list. */
function activeStockTotal(product: PublicProduct): number {
    return product.skus
        .filter((sku) => sku.isActive)
        .reduce((total, sku) => total + sku.stockQuantity, 0);
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
        familyIds: [],
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
        familyIds: product.families.map((family) => family.id),
        images: product.images.map((image) => ({
            key: image.id,
            url: image.url,
            isMain: image.isMain,
            position: image.position,
        })),
        variants: product.variants.map((variant) => ({
            key: variant.id,
            name: variant.name,
            variantType: variant.variantType,
            values: variant.values.map((value) => ({
                key: value.id,
                value: value.value,
                hexColor: value.hexColor ?? '',
                imageKey: value.imageKey || value.imageId || '',
            })),
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
        familyIds: form.familyIds,
        images: form.images.map((image, index) => ({
            key: image.key,
            url: image.url,
            isMain: index === effectiveMain,
            position: Number(image.position),
        })),
        variants: form.variants.map((variant) => ({
            key: variant.key,
            name: variant.name.trim(),
            variantType: variant.variantType,
            values: variant.values.map((value) => ({
                key: value.key,
                value: value.value.trim(),
                hexColor:
                    variant.variantType === 'COLOR' && value.hexColor.trim() !== ''
                        ? value.hexColor.trim()
                        : null,
                imageKey: value.imageKey.trim() === '' ? null : value.imageKey.trim(),
            })),
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
    onChangeValue: (variantKey: string, valueKey: string, changes: Partial<VariantValueDraft>) => void;
    onAddValue: (variantKey: string) => void;
    onRemoveValue: (variantKey: string, valueKey: string) => void;
    onRemove: (key: string) => void;
}

function VariantRow({
    variant,
    images,
    t,
    onChange,
    onChangeValue,
    onAddValue,
    onRemoveValue,
    onRemove,
}: VariantRowProps): React.JSX.Element {
    const orderedImages = [...images].sort(
        (a, b) => a.position - b.position || a.key.localeCompare(b.key),
    );

    return (
        <article className="variant-card">
            <div className="variant-card-header">
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
                    <label className="field-label" htmlFor={`variant-type-${variant.key}`}>
                        {t('variantType')}
                    </label>
                    <select
                        id={`variant-type-${variant.key}`}
                        className="field-input"
                        value={variant.variantType}
                        onChange={(event) =>
                            onChange(variant.key, { variantType: event.target.value as VariantType })
                        }
                    >
                        {VARIANT_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {t(`variantType${type}` as TranslationKey)}
                            </option>
                        ))}
                    </select>
                </div>
                <button
                    type="button"
                    className="button danger small variant-remove"
                    onClick={() => onRemove(variant.key)}
                >
                    {t('removeVariant')}
                </button>
            </div>

            <div className="variant-values">
                <span className="field-label">{t('variantValuesLabel')}</span>
                {variant.values.map((value) => (
                    <div className="variant-value-row" key={value.key}>
                        <div className="field">
                            <label className="field-label" htmlFor={`variant-value-${value.key}`}>
                                {t('variantValue')}
                            </label>
                            <input
                                id={`variant-value-${value.key}`}
                                className="field-input"
                                list={variant.variantType === 'SIZE_TEXT' ? `size-values-${variant.key}` : undefined}
                                value={value.value}
                                onChange={(event) =>
                                    onChangeValue(variant.key, value.key, { value: event.target.value })
                                }
                            />
                            {variant.variantType === 'SIZE_TEXT' ? (
                                <datalist id={`size-values-${variant.key}`}>
                                    {SIZE_TEXT_VALUES.map((size) => (
                                        <option key={size} value={size} />
                                    ))}
                                </datalist>
                            ) : null}
                        </div>
                        {variant.variantType === 'COLOR' ? (
                            <div className="field">
                                <label className="field-label" htmlFor={`variant-color-${value.key}`}>
                                    {t('hexColor')}
                                </label>
                                <div className="color-input-group">
                                    <span
                                        className="color-swatch"
                                        style={{ backgroundColor: value.hexColor || '#ffffff' }}
                                        aria-hidden="true"
                                    />
                                    <input
                                        id={`variant-color-${value.key}`}
                                        className="field-input"
                                        type="color"
                                        value={/^#[0-9A-Fa-f]{6}$/.test(value.hexColor) ? value.hexColor : '#000000'}
                                        onChange={(event) =>
                                            onChangeValue(variant.key, value.key, { hexColor: event.target.value })
                                        }
                                    />
                                    <input
                                        className="field-input color-hex-input"
                                        value={value.hexColor}
                                        placeholder="#RRGGBB"
                                        aria-label={t('hexColor')}
                                        onChange={(event) =>
                                            onChangeValue(variant.key, value.key, { hexColor: event.target.value })
                                        }
                                    />
                                </div>
                            </div>
                        ) : null}
                        <div className="field">
                            <label className="field-label" htmlFor={`variant-image-${value.key}`}>
                                {t('variantImage')}
                            </label>
                            <select
                                id={`variant-image-${value.key}`}
                                className="field-input"
                                value={value.imageKey}
                                onChange={(event) =>
                                    onChangeValue(variant.key, value.key, { imageKey: event.target.value })
                                }
                            >
                                <option value="">{t('selectImage')}</option>
                                {orderedImages.map((image, index) => (
                                    <option key={image.key} value={image.key}>
                                        {`${t('imageNumber')} ${index + 1}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            className="button danger small variant-value-remove"
                            onClick={() => onRemoveValue(variant.key, value.key)}
                            aria-label={t('removeVariantValue')}
                        >
                            ×
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="button secondary small"
                    onClick={() => onAddValue(variant.key)}
                >
                    {t('addVariantValue')}
                </button>
            </div>
        </article>
    );
}

export function ProductManager(): React.JSX.Element {
    const { admin } = useAuth();
    const { locale, t } = useDashboard();
    const canManage =
        admin?.role === AdminRole.SYSTEM || admin?.role === AdminRole.MANAGER;

    const [products, setProducts] = useState<PublicProduct[]>([]);
    const [categories, setCategories] = useState<PublicCategory[]>([]);
    const [families, setFamilies] = useState<PublicFamily[]>([]);
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
            const [productList, categoryList, familyList] = await Promise.all([
                adminApi.listProducts(),
                adminApi.listCategories(),
                adminApi.listFamilies(),
            ]);
            setProducts(productList);
            setCategories(categoryList);
            setFamilies(familyList);
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
    const integerFormatter = new Intl.NumberFormat(locale);
    const formatDate = (value: string) => dateFormatter.format(new Date(value));

    /** SKUs are generated by the API on save; show the persisted ones while editing. */
    const editingSkus: PublicProductSku[] =
        editingId === null
            ? []
            : (products.find((product) => product.id === editingId)?.skus ?? []);

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

    const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const categoryIds = Array.from(event.target.options)
            .filter((option) => option.selected)
            .map((option) => option.value);
        setForm((current) => ({ ...current, categoryIds }));
    };

    const toggleFamily = (id: string) => {
        setForm((current) => ({
            ...current,
            familyIds: current.familyIds.includes(id)
                ? current.familyIds.filter((value) => value !== id)
                : [...current.familyIds, id],
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
                variants: current.variants.map((variant) => ({
                    ...variant,
                    values: variant.values.map((value) =>
                        value.imageKey === key ? { ...value, imageKey: '' } : value,
                    ),
                })),
            };
        });
    };

    const makeValueDraft = (): VariantValueDraft => ({
        key: nextTempKey('variant-value'),
        value: '',
        hexColor: '',
        imageKey: '',
    });

    const addVariant = () => {
        setForm((current) => ({
            ...current,
            variants: [
                ...current.variants,
                {
                    key: nextTempKey('variant'),
                    name: '',
                    variantType: 'OTHER',
                    values: [makeValueDraft()],
                },
            ],
        }));
    };

    const changeVariant = (key: string, changes: Partial<VariantDraft>) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.map((variant) => {
                if (variant.key !== key) return variant;
                const next = { ...variant, ...changes };
                if (changes.variantType !== undefined && changes.variantType !== 'COLOR') {
                    next.values = variant.values.map((value) => ({ ...value, hexColor: '' }));
                }
                return next;
            }),
        }));
    };

    const removeVariant = (key: string) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.filter((variant) => variant.key !== key),
        }));
    };

    const addVariantValue = (variantKey: string) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.map((variant) =>
                variant.key === variantKey
                    ? { ...variant, values: [...variant.values, makeValueDraft()] }
                    : variant,
            ),
        }));
    };

    const changeVariantValue = (
        variantKey: string,
        valueKey: string,
        changes: Partial<VariantValueDraft>,
    ) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.map((variant) =>
                variant.key === variantKey
                    ? {
                        ...variant,
                        values: variant.values.map((value) =>
                            value.key === valueKey ? { ...value, ...changes } : value,
                        ),
                    }
                    : variant,
            ),
        }));
    };

    const removeVariantValue = (variantKey: string, valueKey: string) => {
        setForm((current) => ({
            ...current,
            variants: current.variants.map((variant) =>
                variant.key === variantKey
                    ? { ...variant, values: variant.values.filter((value) => value.key !== valueKey) }
                    : variant,
            ),
        }));
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (files.length === 0) return;

        setFormError(null);
        setUploading(true);
        try {
            for (const file of files) {
                const response = await adminApi.uploadImage(file, 'product');
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
            }
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
            if (variant.name.trim() === '' || variant.values.length === 0) {
                setFormError(t('variantDefinitionInvalid'));
                return;
            }
            for (const value of variant.values) {
                if (value.value.trim() === '') {
                    setFormError(t('variantValueRequired'));
                    return;
                }
                if (variant.variantType === 'SIZE_TEXT' && !SIZE_TEXT_VALUES.includes(value.value.trim().toUpperCase() as never)) {
                    setFormError(t('sizeTextInvalid'));
                    return;
                }
                if (variant.variantType === 'SIZE_NUM' && !/^\d+(\.\d{1,2})?$/.test(value.value.trim())) {
                    setFormError(t('sizeNumInvalid'));
                    return;
                }
                if (
                    variant.variantType === 'COLOR' &&
                    !/^#[0-9A-Fa-f]{6}$/.test(value.hexColor.trim())
                ) {
                    setFormError(t('hexColorInvalid'));
                    return;
                }
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
                    <div className="table-toolbar-meta">
                        <span className="stat-note">
                            {t('showingProducts')} {filteredProducts.length} / {products.length}
                        </span>
                        <span className="catalog-status">
                            <span className="status-dot" aria-hidden="true" />
                            {t('catalogLive')}
                        </span>
                    </div>
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
                                    <th scope="col" className="column-center">{t('columnStock')}</th>
                                    <th scope="col" className="column-right">{t('columnPmp')}</th>
                                    <th scope="col">{t('columnCategories')}</th>
                                    <th scope="col">{t('familiesLabel')}</th>
                                    <th scope="col" className="column-center">{t('columnImages')}</th>
                                    <th scope="col" className="column-center">{t('columnVariants')}</th>
                                    <th scope="col">{t('columnSkus')}</th>
                                    <th scope="col">{t('createdAt')}</th>
                                    {canManage ? <th scope="col" className="column-actions">{t('actions')}</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product) => (
                                    <tr key={product.id}>
                                        <td>
                                            <strong className="table-ref">{product.ref}</strong>
                                        </td>
                                        <td>
                                            <span className="client-primary product-name">
                                                {product.name}
                                            </span>
                                            {product.subtitle ? (
                                                <span className="client-secondary product-subtitle">
                                                    {product.subtitle}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="table-price">
                                            {numberFormatter.format(product.price)}
                                        </td>
                                        <td className="text-center">
                                            <span className="count-badge">
                                                {integerFormatter.format(product.quantity)}
                                            </span>
                                        </td>
                                        <td className="table-price text-right">
                                            {numberFormatter.format(product.PMP)}
                                        </td>
                                        <td>
                                            <div className="category-tags">
                                                {product.categories.length === 0 ? (
                                                    <span className="muted">—</span>
                                                ) : (
                                                    product.categories.map((category) => (
                                                        <span
                                                            className="category-tag"
                                                            key={category.id}
                                                        >
                                                            {category.name}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="category-tags">
                                                {product.families.length === 0 ? (
                                                    <span className="muted">—</span>
                                                ) : (
                                                    product.families.map((family) => (
                                                        <span className="family-tag" key={family.id}>
                                                            {family.name}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <span className="count-badge">
                                                {product.images.length}
                                            </span>
                                        </td>
                                        <td className="muted text-center">
                                            {product.variants.length}
                                        </td>
                                        <td>
                                            <span
                                                className={
                                                    activeStockTotal(product) > 0
                                                        ? 'stock-badge in-stock'
                                                        : 'stock-badge out-of-stock'
                                                }
                                            >
                                                {integerFormatter.format(activeStockTotal(product))}
                                            </span>
                                        </td>
                                        <td className="muted table-date">
                                            {formatDate(product.createdAt)}
                                        </td>
                                        {canManage ? (
                                            <td className="table-actions">
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
                            <label className="field-label" htmlFor="product-categories">
                                {t('categoriesLabel')}
                            </label>
                            <p className="field-hint">{t('categoriesHint')}</p>
                            <select
                                id="product-categories"
                                className="field-input"
                                multiple
                                value={form.categoryIds}
                                onChange={handleCategoryChange}
                            >
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="field">
                            <span className="field-label">{t('familiesLabel')}</span>
                            <p className="field-hint">{t('familiesHint')}</p>
                            <div className="chip-select">
                                {families.length === 0 ? (
                                    <span className="muted">{t('familiesEmptyHint')}</span>
                                ) : (
                                    families.map((family) => {
                                        const selected = form.familyIds.includes(family.id);
                                        return (
                                            <label
                                                key={family.id}
                                                className={selected ? 'chip selected' : 'chip'}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleFamily(family.id)}
                                                />
                                                <span>{family.name}</span>
                                            </label>
                                        );
                                    })
                                )}
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
                                    multiple
                                    aria-label={t('imageFileLabel')}
                                    onChange={(event) => void handleFileChange(event)}
                                />
                                <span className="field-hint">{t('uploadMultipleHint')}</span>
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
                            <div className="notice info variant-price-note" role="note">
                                <strong className="notice-title">{t('variantNoPriceTitle')}</strong>
                                <span>{t('variantNoPriceNote')}</span>
                            </div>
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
                                            onChangeValue={changeVariantValue}
                                            onAddValue={addVariantValue}
                                            onRemoveValue={removeVariantValue}
                                            onRemove={removeVariant}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {editingId !== null ? (
                            <div className="field">
                                <span className="field-label">{t('skusLabel')}</span>
                                <p className="field-hint">{t('skusHint')}</p>
                                {editingSkus.length === 0 ? (
                                    <p className="state-text">{t('skusEmpty')}</p>
                                ) : (
                                    <div className="table-scroll">
                                        <table className="data-table sku-table">
                                            <thead>
                                                <tr>
                                                    <th scope="col">{t('columnSku')}</th>
                                                    <th scope="col">{t('skuLabel')}</th>
                                                    <th scope="col" className="column-right">{t('columnStock')}</th>
                                                    <th scope="col" className="column-right">{t('columnPmp')}</th>
                                                    <th scope="col">{t('status')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {editingSkus.map((sku) => (
                                                    <tr key={sku.id}>
                                                        <td><strong className="table-ref">{sku.sku}</strong></td>
                                                        <td>{sku.label || '—'}</td>
                                                        <td className="table-price text-right">
                                                            {integerFormatter.format(sku.stockQuantity)}
                                                        </td>
                                                        <td className="table-price text-right">
                                                            {numberFormatter.format(sku.PMP)}
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={
                                                                    sku.isActive ? 'badge active' : 'badge inactive'
                                                                }
                                                            >
                                                                {sku.isActive ? t('active') : t('inactive')}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ) : null}

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
