declare module 'connect-redis' {
  import session from 'express-session';
  import { RedisClientType } from 'redis';
  class RedisStore extends session.Store {
    constructor(options: { client: RedisClientType<any, any, any> });
  }
  export default RedisStore;
} 