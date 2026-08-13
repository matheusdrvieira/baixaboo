import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  BACKEND_URL: z.string().url(),
  FRONTEND_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/$/, "")),
});

export const env = envSchema.parse({
  NODE_ENV: process.env["NODE_ENV"],
  BACKEND_URL: process.env["NEXT_PUBLIC_BACKEND_URL"],
  FRONTEND_URL: process.env["NEXT_PUBLIC_FRONTEND_URL"],
});
