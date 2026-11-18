/** Postgres `numeric` values arrive as strings; expose plain numbers in the API. */
export const numericTransformer = {
    to: (value: number): number => Number(value),
    from: (value: string | number | null): number | null =>
        value === null || value === undefined ? null : Number(value),
};
