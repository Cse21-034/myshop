declare module 'passport-google-oauth20' {
  import { Strategy as PassportStrategy } from 'passport-strategy';
  import { Request } from 'express';

  export interface Profile extends Record<string, any> {
    id: string;
    displayName: string;
    name?: {
      familyName: string;
      givenName: string;
    };
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    passReqToCallback?: boolean;
  }

  export type VerifyCallback = (error: any, user?: any, info?: any) => void;

  export class Strategy extends PassportStrategy {
    constructor(
      options: StrategyOptions,
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => void
    );
  }
} 