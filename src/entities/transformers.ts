import { ValueTransformer } from 'typeorm';

export const numericTransformer: ValueTransformer = {
  to(value: number | null | undefined): number | null | undefined {
    return value;
  },
  from(value: string | number | null | undefined): number | null | undefined {
    if (value === null || value === undefined) return value as any;
    return Number(value);
  },
};
