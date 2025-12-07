//
//
// Constants
//

export const EXPRESS = {
  PATH: {
    ANY: "*",
    ID: "/:id",
    ROOT: /^\/?$/,
  },
} as const;

export type ExpressConstants = typeof EXPRESS;
