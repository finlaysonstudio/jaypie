import { ERROR, HTTP, NAME, JaypieError as IJaypieError, JaypieErrorBody, JaypieErrorJson } from "./types";
interface ErrorOptions {
  title?: string;
  status?: number;
}

interface InternalOptions {
  _type?: string;
}

export class JaypieError extends Error implements IJaypieError {
  title: string;
  detail: string;
  status: number;
  isProjectError: boolean;
  isJaypieError: boolean;
  _type: string;
  body: () => JaypieErrorBody;
  json: () => JaypieErrorJson;

  constructor(
    message: string = ERROR.MESSAGE.INTERNAL_ERROR,
    { status = HTTP.CODE.INTERNAL_ERROR, title = ERROR.TITLE.INTERNAL_ERROR }: ErrorOptions = {},
    { _type = ERROR.TYPE.UNKNOWN_TYPE }: InternalOptions = {}
  ) {
    super(message);
    this.title = title;
    this.detail = message;
    this.status = status;
    this.name = NAME;
    this.isProjectError = true;
    this.isJaypieError = true;
    this._type = _type;
    this.body = () => ({
      errors: [{
        status: this.status,
        title: this.title,
        detail: this.detail,
      }]
    });
    this.json = () => ({
      status: this.status,
      title: this.title,
      detail: this.detail,
    });
  }
}
