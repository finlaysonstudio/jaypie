declare module "gray-matter" {
  interface GrayMatterOption {
    excerpt?: boolean | ((input: any, options: any) => string);
    excerpt_separator?: string;
    engines?: {
      [index: string]: (input: string) => object;
    };
    language?: string;
    delimiters?: string | [string, string];
  }

  interface GrayMatterFile<I> {
    data: I;
    content: string;
    excerpt?: string;
    orig: Buffer | I;
    language: string;
    matter: string;
    stringify: (lang: string) => string;
  }

  function matter<I = any>(
    input: string | Buffer,
    options?: GrayMatterOption
  ): GrayMatterFile<I>;

  export = matter;
}