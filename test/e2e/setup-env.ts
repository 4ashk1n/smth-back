const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  AUTH_JWT_SECRET: 'e2e_jwt_secret',
  AUTH_ACCESS_TOKEN_TTL_SEC: '900',
  AUTH_REFRESH_TOKEN_TTL_SEC: '2592000',
  AUTH_REFRESH_TOKEN_PEPPER: 'e2e_refresh_pepper',
  GOOGLE_CLIENT_ID: 'e2e_google_client_id',
  GOOGLE_CLIENT_SECRET: 'e2e_google_client_secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/auth/google/callback',
  TIKTOK_CLIENT_KEY: 'e2e_tiktok_key',
  TIKTOK_CLIENT_SECRET: 'e2e_tiktok_secret',
  TIKTOK_CALLBACK_URL: 'http://localhost:3000/api/auth/tiktok/callback',
  YANDEX_CLIENT_ID: 'e2e_yandex_client_id',
  YANDEX_CLIENT_SECRET: 'e2e_yandex_client_secret',
  YANDEX_CALLBACK_URL: 'http://localhost:3000/api/auth/yandex/callback',
  S3_ACCESS_KEY_ID: 'e2e_s3_access_key',
  S3_SECRET_ACCESS_KEY: 'e2e_s3_secret',
  S3_BUCKET: 'e2e-bucket',
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
