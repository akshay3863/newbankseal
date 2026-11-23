/**
 * Listing media contract (01-FOUNDATION: "Cloudinary uploads signed server-side; limit
 * MIME, size and access").
 *
 * Shared by the admin upload form (instant feedback) and the server (the control).
 * The browser uploads straight to Cloudinary with a signature our server issues, so the
 * file never transits our functions — but a signature alone does not bound the file a
 * client actually sends. The server therefore checks the uploaded asset against this
 * policy before attaching it to a listing, and deletes it from Cloudinary if it fails.
 */

export const LISTING_IMAGE_POLICY = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  /** Cloudinary format names, passed as the signed `allowed_formats` parameter. */
  allowedFormats: ['jpg', 'png', 'webp', 'avif'],
  maxBytes: 10 * 1024 * 1024,
  maxImagesPerListing: 20,
  /** Every upload lands under this folder, then `/<listingId>`. Nothing else is signed. */
  folder: 'bank-seal/listings',
} as const;

export type ListingImageMimeType = (typeof LISTING_IMAGE_POLICY.allowedMimeTypes)[number];

export function isAllowedImageMimeType(value: string): value is ListingImageMimeType {
  return (LISTING_IMAGE_POLICY.allowedMimeTypes as readonly string[]).includes(value);
}

/** `POST /api/admin/media/sign` request. Size and type are re-checked after upload. */
export interface MediaSignRequest {
  listingId: string;
  mimeType: ListingImageMimeType;
  bytes: number;
}

/** Everything the browser needs to POST the file to Cloudinary, and nothing more. */
export interface MediaSignResponse {
  uploadUrl: string;
  /** Form fields to send alongside the file: api_key, timestamp, signature, folder, … */
  fields: Record<string, string>;
}

/** An image attached to a listing, as admin and public DTOs expose it. */
export interface ListingMedia {
  id: string;
  /** Cloudinary public id — the handle for transformations and for deletion. */
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  position: number;
}
