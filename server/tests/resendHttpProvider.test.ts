import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResendHttpOtpProvider } from '../src/services/resendHttpOtpProvider.js';

describe('ResendHttpOtpProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should successfully deliver an OTP via Resend HTTPS API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend_msg_123' }),
    });
    global.fetch = mockFetch;

    const provider = new ResendHttpOtpProvider({
      apiKey: 're_test_key_12345',
      fromAddress: 'onboarding@resend.dev',
      fromName: 'CivicTrust Auth',
      timeoutMs: 5000,
    });

    await expect(provider.sendChallenge('citizen@example.com', '654321', 'EMAIL')).resolves.not.toThrow();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];

    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer re_test_key_12345');
    expect(init.headers['Content-Type']).toBe('application/json');

    const parsedBody = JSON.parse(init.body);
    expect(parsedBody.to).toEqual(['citizen@example.com']);
    expect(parsedBody.from).toBe('"CivicTrust Auth" <onboarding@resend.dev>');
    expect(parsedBody.subject).toBe('Your CivicTrust Verification Code');
    expect(parsedBody.html).toContain('654321');
  });

  it('should handle API error responses gracefully (e.g. 422 Unprocessable)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        name: 'validation_error',
        message: 'You can only send testing emails to your own email address.',
      }),
    });
    global.fetch = mockFetch;

    const provider = new ResendHttpOtpProvider({
      apiKey: 're_test_key_12345',
      timeoutMs: 5000,
    });

    await expect(provider.sendChallenge('external@example.com', '123456', 'EMAIL')).rejects.toThrow(
      /Failed to send OTP challenge via Resend API \(status: 422\)/
    );
  });

  it('should handle non-JSON API error responses (e.g. 502 HTML/text error)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Invalid JSON');
      },
      text: async () => 'Bad Gateway',
    });
    global.fetch = mockFetch;

    const provider = new ResendHttpOtpProvider({
      apiKey: 're_test_key_12345',
      timeoutMs: 5000,
    });

    await expect(provider.sendChallenge('user@example.com', '123456', 'EMAIL')).rejects.toThrow(
      /Failed to send OTP challenge via Resend API \(status: 502\)/
    );
  });

  it('should handle request timeout properly', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';

    const mockFetch = vi.fn().mockRejectedValue(timeoutError);
    global.fetch = mockFetch;

    const provider = new ResendHttpOtpProvider({
      apiKey: 're_test_key_12345',
      timeoutMs: 5000,
    });

    await expect(provider.sendChallenge('user@example.com', '123456', 'EMAIL')).rejects.toThrow(
      /Resend API request timed out after 5000ms/
    );
  });

  it('should reject when API key is missing or blank', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const provider = new ResendHttpOtpProvider({
      apiKey: '',
    });

    await expect(provider.sendChallenge('user@example.com', '123456', 'EMAIL')).rejects.toThrow(
      /Resend API key is not configured/
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should reject unsupported delivery methods', async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const provider = new ResendHttpOtpProvider({
      apiKey: 're_test_key_12345',
    });

    await expect(provider.sendChallenge('+919876543210', '123456', 'SMS')).rejects.toThrow(
      /does not support delivery method: SMS/
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
