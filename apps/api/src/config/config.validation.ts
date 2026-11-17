import Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3002),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  OTP_SECRET: Joi.string().min(16).required(),

  SESSION_TTL_S: Joi.number().integer().min(60).default(2592000),
  SESSION_SHORT_TTL_S: Joi.number().integer().min(60).default(86400),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:3001'),

  // Optional: Google login is disabled when these are empty.
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().allow('').optional(),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
}).unknown(true);
