import { NodemailerOtpProvider } from './nodemailerOtpProvider.js';
import { ResendHttpOtpProvider } from './resendHttpOtpProvider.js';
import { OtpService } from './otpService.js';
import { MemoryOtpStore } from '../db/memoryOtpStore.js';
import type { OtpProvider, DeliveryMethod } from '../types/otp.js';

import { CONFIG } from '../config.js';
import { SupabaseOtpStore } from '../db/supabaseOtpStore.js';
import { getSupabaseClient } from '../db/supabase.js';

class ConsoleOtpProvider implements OtpProvider {
  async sendChallenge(identifier: string, code: string, method: DeliveryMethod): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n================ OTP SENT ================`);
      console.log(`Method:  ${method}`);
      console.log(`To:      ${identifier}`);
      console.log(`Code:    ${code}`);
      console.log(`==========================================\n`);
    }
  }
}

const memoryStore = new MemoryOtpStore();

export const otpStore = (() => {
  if (CONFIG.DATA_STORE === 'supabase') {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('[OtpStore] DATA_STORE is supabase but client initialization failed. Falling back to MemoryOtpStore.');
      return memoryStore;
    }
    return new SupabaseOtpStore(client);
  }
  return memoryStore;
})();
export const otpProvider: OtpProvider = (() => {
  if (CONFIG.RESEND_API_KEY) {
    return new ResendHttpOtpProvider();
  }

  if (CONFIG.SMTP_HOST && CONFIG.SMTP_PASS) {
    return new NodemailerOtpProvider();
  }
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: Missing email provider configuration (RESEND_API_KEY or SMTP) in production environment.');
  }
  
  console.warn('[OtpProvider] Missing email provider config. Falling back to ConsoleOtpProvider.');
  return new ConsoleOtpProvider();
})();

// 10 minutes expiry, 3 max attempts
export const otpService = new OtpService(otpStore, otpProvider, 10, 3);
