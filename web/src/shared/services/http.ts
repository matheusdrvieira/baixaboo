import { env } from "@/shared/config/env";
import axios from "axios";

export const api = axios.create({
  baseURL: env.BACKEND_URL,
  headers: { "X-API-Key": env.API_KEY },
  timeout: 30_000,
  withCredentials: true,
});
