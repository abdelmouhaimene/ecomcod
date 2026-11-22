/** Postgres `numeric` values arrive as strings; expose plain numbers in the API. */
export const numericTransformer = {
    // Preserve NULL/undefined on writes: `Number(null)` silently becomes 0,
    // which breaks nullable columns (offers.packPrice), and `Number(undefined)`
    // becomes NaN, which can bypass numeric checks. Letting undefined through
    // makes TypeORM emit DEFAULT so NOT NULL columns like products.PMP use 0.
    to: (value: number | null | undefined): number | undefined =>
        value === null || value === undefined ? undefined : Number(value),
    from: (value: string | number | null): number | null =>
        value === null || value === undefined ? null : Number(value),
};
