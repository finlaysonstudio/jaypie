//
//
// Constants
//

export const EXPRESS = {
  PATH: {
    // RegExp matches all paths in Express 4 and 5; "*" throws in 5, "/{*splat}" throws in 4
    ANY: /(.*)/,
    ID: "/:id",
    ROOT: /^\/?$/,
  },
} as const;

export type ExpressConstants = typeof EXPRESS;
