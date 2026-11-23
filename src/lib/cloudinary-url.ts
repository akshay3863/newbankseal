/**
 * Parser for `CLOUDINARY_URL` — `cloudinary://<api_key>:<api_secret>@<cloud_name>`, the
 * format Cloudinary's console issues and its SDKs read.
 *
 * Side-effect free and runtime-agnostic, so env validation and the edge middleware
 * (which needs only the cloud name, to scope its CSP) share one definition. It never
 * logs or echoes its input: the value carries the API secret.
 */

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

const CLOUD_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export function parseCloudinaryUrl(raw: string | null | undefined): CloudinaryCredentials | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'cloudinary:') return null;

    const cloudName = url.hostname;
    const apiKey = decodeURIComponent(url.username);
    const apiSecret = decodeURIComponent(url.password);
    if (!CLOUD_NAME.test(cloudName) || !apiKey || !apiSecret) return null;

    return { cloudName, apiKey, apiSecret };
  } catch {
    // Unparseable URL or a malformed percent-escape: treated as not configured.
    return null;
  }
}
