export enum OpenError {
  AppNotFound = 'AppNotFound',
  ErrorOnLaunch = 'ErrorOnLaunch',
  AppTimeout = 'AppTimeout',
  ResolverUnavailable = 'ResolverUnavailable'
}

export enum ResolveError {
  NoAppsFound = 'NoAppsFound',
  ResolverUnavailable = 'ResolverUnavailable',
  ResolverTimeout = 'ResolverTimeout',
  InvalidContext = 'InvalidContext'
}

export class FDC3Error extends Error{
  public code: string;
  public constructor(code: string, message: string) {
      super(message);
      this.code = code;
  }
}
