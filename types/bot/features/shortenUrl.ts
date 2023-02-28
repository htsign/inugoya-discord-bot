export type XgdUrl = `https://x.gd/${string}`;
export type XgdSuccessMessage = `\`${Url}\`: <${XgdUrl}>`;
export type XgdFailureMessage = `error occurred [${XgdFailureStatus | number}]: ${string}`;
export type XgdSuccessStatus = 200;
export type XgdFailureStatus = 400 | 401 | 403 | 409 | 429 | 500 | 503;
export type XgdStatus = XgdSuccessStatus | XgdFailureStatus;

export interface XgdRequest {
  key: string;
  url: Url;
  shortid?: string;
  analytics?: boolean; // default: true
  filterbots?: boolean; // default: false
}

export interface XgdSuccessResponse {
  status: XgdSuccessStatus;
  shorturl: XgdUrl;
  analytics: boolean;
  filterbots: boolean;
  originalurl: Url;
}

export interface XgdFailureResponse {
  status: XgdFailureStatus;
  message: string;
}

export type XgdResponse = XgdSuccessResponse | XgdFailureResponse;
