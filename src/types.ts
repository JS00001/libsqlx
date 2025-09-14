export type Primitive = number | string | undefined | null | boolean;

export type Params<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;
