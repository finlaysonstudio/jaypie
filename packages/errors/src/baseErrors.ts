import {
  ERROR,
  HTTP,
  NAME,
  JaypieError as IJaypieError,
  JaypieErrorResponseBody,
  JaypieErrorJson,
} from "./types";
export interface CauseOptions {
  cause?: unknown;
}

export interface ErrorOptions extends CauseOptions {
  title?: string;
  status?: number;
}

interface InternalOptions {
  _type?: string;
}

export class JaypieError extends Error implements IJaypieError {
  // `declare` because the target lib predates `Error.cause`; assigning it
  // conditionally below keeps native semantics, where an error built without
  // the option has no `cause` property at all
  declare cause?: unknown;
  title: string;
  detail: string;
  status: number;
  isProjectError: boolean;
  isJaypieError: boolean;
  _type: string;
  body: () => JaypieErrorResponseBody;
  json: () => JaypieErrorJson;

  constructor(
    message: string = ERROR.MESSAGE.INTERNAL_ERROR,
    options: ErrorOptions = {},
    { _type = ERROR.TYPE.UNKNOWN_TYPE }: InternalOptions = {},
  ) {
    const {
      status = HTTP.CODE.INTERNAL_ERROR,
      title = ERROR.TITLE.INTERNAL_ERROR,
    } = options;
    super(message);
    if ("cause" in options) {
      this.cause = options.cause;
    }
    this.title = title;
    this.detail = message;
    this.status = status;
    this.name = NAME;
    this.isProjectError = true;
    this.isJaypieError = true;
    this._type = _type;
    this.body = () => ({
      errors: [
        {
          status: this.status,
          title: this.title,
          detail: this.detail,
        },
      ],
    });
    this.json = () => ({
      status: this.status,
      title: this.title,
      detail: this.detail,
    });
  }
}
