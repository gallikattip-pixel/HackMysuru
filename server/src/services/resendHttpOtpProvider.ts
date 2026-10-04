import type { OtpProvider, DeliveryMethod } from '../types/otp.js';
import { CONFIG } from '../config.js';

export interface ResendHttpOtpProviderOptions {
  apiKey?: string;
  fromAddress?: string;
  fromName?: string;
  timeoutMs?: number;
}

export class ResendHttpOtpProvider implements OtpProvider {
  private apiKey: string;
  private fromAddress: string;
  private fromName: string;
  private timeoutMs: number;

  constructor(options?: ResendHttpOtpProviderOptions) {
    this.apiKey = options?.apiKey ?? CONFIG.RESEND_API_KEY;
    this.fromAddress = options?.fromAddress ?? CONFIG.EMAIL_FROM_ADDRESS;
    this.fromName = options?.fromName ?? CONFIG.EMAIL_FROM_NAME;
    this.timeoutMs = options?.timeoutMs ?? 5000;
  }

  async sendChallenge(identifier: string, code: string, method: DeliveryMethod): Promise<void> {
    if (method !== 'EMAIL') {
      throw new Error(`ResendHttpOtpProvider does not support delivery method: ${method}`);
    }

    if (!this.apiKey || !this.apiKey.trim()) {
      console.error('[ResendHttpOtpProvider] Missing Resend API key.');
      throw new Error('Resend API key is not configured.');
    }

    const fromAddress = this.fromAddress?.trim() || 'onboarding@resend.dev';
    const fromName = this.fromName?.trim() || 'CivicTrust Auth';
    const from = `"${fromName}" <${fromAddress}>`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
        <h2 style="color: #008080;">CivicTrust Verification</h2>
        <p>Your one-time password (OTP) is:</p>
        <h1 style="letter-spacing: 5px; color: #333; background: #f4f4f4; padding: 15px; border-radius: 8px;">${code}</h1>
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey.trim()}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CivicBridge/1.0',
        },
        body: JSON.stringify({
          from,
          to: [identifier],
          subject: 'Your CivicTrust Verification Code',
          html,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errJson = (await response.json()) as any;
          errorDetail = errJson?.message || errJson?.name || JSON.stringify(errJson);
        } catch {
          errorDetail = await response.text().catch(() => '');
        }
        console.error(`[ResendHttpOtpProvider] Resend API error (${response.status}): ${errorDetail}`);
        throw new Error(`Failed to send OTP challenge via Resend API (status: ${response.status}).`);
      }

      console.log(`[ResendHttpOtpProvider] Successfully delivered OTP via Resend HTTPS API.`);
    } catch (error: any) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        console.error(`[ResendHttpOtpProvider] Outbound delivery timed out after ${this.timeoutMs}ms.`);
        throw new Error(`Resend API request timed out after ${this.timeoutMs}ms.`);
      }

      // If already wrapped or specific API error, rethrow
      if (
        error?.message?.startsWith('Failed to send OTP challenge via Resend API') ||
        error?.message?.includes('Resend API key')
      ) {
        throw error;
      }

      console.error('[ResendHttpOtpProvider] Failed to send email via Resend API:', error?.message || error);
      throw new Error('Failed to send OTP challenge via Resend API.');
    }
  }
}
