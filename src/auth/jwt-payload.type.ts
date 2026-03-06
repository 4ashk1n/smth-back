export interface AccessTokenPayload {
  sub: string;
  email: string | null;
}

export interface RefreshTokenPayload extends AccessTokenPayload {
  type: 'refresh';
  jti: string;
}
