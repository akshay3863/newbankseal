import { describe, expect, it } from 'vitest';
import { parseCloudinaryUrl } from './cloudinary-url';

describe('parseCloudinaryUrl', () => {
  it('parses the format the Cloudinary console issues', () => {
    expect(parseCloudinaryUrl('cloudinary://123456789012345:abc-DEF_ghi@bank-seal')).toEqual({
      cloudName: 'bank-seal',
      apiKey: '123456789012345',
      apiSecret: 'abc-DEF_ghi',
    });
  });

  it('treats blank and missing values as unset', () => {
    expect(parseCloudinaryUrl(undefined)).toBeNull();
    expect(parseCloudinaryUrl('   ')).toBeNull();
  });

  it('rejects other schemes and missing credentials', () => {
    expect(parseCloudinaryUrl('https://key:secret@bank-seal')).toBeNull();
    expect(parseCloudinaryUrl('cloudinary://bank-seal')).toBeNull();
    expect(parseCloudinaryUrl('cloudinary://key@bank-seal')).toBeNull();
  });

  it('returns null rather than throwing on a malformed escape', () => {
    expect(parseCloudinaryUrl('cloudinary://%E0%A4%A:secret@bank-seal')).toBeNull();
  });
});
