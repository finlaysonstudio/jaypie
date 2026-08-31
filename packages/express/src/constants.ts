//
//
// Constants
//

export const EXPRESS = {
  HEADER: {
    /**
     * Request headers redacted from the handler's request log by default.
     * `expressHandler`'s `sensitiveHeaders` option adds to this list; it does
     * not replace it.
     */
    SENSITIVE: ["authorization", "cookie", "set-cookie"],
  },
  PATH: {
    // RegExp matches all paths in Express 4 and 5; "*" throws in 5, "/{*splat}" throws in 4
    ANY: /(.*)/,
    ID: "/:id",
    ROOT: /^\/?$/,
  },
} as const;

export type ExpressConstants = typeof EXPRESS;
