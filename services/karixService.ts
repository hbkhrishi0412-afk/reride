/**
 * Karix SMS Service
 * Handles OTP sending via Karix SMS API
 */

interface KarixConfig {
  apiKey: string;
  apiSecret: string;
  apiUrl?: string;
}

interface KarixOTPResult {
  success: boolean;
  error?: string;
}

/**
 * Get Karix configuration from environment variables
 * @returns KarixConfig if configured, null otherwise
 */
export function getKarixConfig(): KarixConfig | null {
  const apiKey = process.env.KARIX_API_KEY;
  const apiSecret = process.env.KARIX_API_SECRET;
  const apiUrl = process.env.KARIX_API_URL || 'https://api.karix.io/message/';

  if (!apiKey || !apiSecret) {
    return null;
  }

  return {
    apiKey,
    apiSecret,
    apiUrl
  };
}

/**
 * Send OTP via Karix SMS API
 * @param phoneNumber - Phone number in E.164 format (e.g., +919876543210)
 * @param otp - 6-digit OTP code
 * @param config - Karix configuration
 * @returns Promise with success status and optional error message
 */
export async function sendKarixOTP(
  phoneNumber: string,
  otp: string,
  config: KarixConfig
): Promise<KarixOTPResult> {
  try {
    const message = `Your OTP for ReRide is ${otp}. Valid for 10 minutes. Do not share this with anyone.`;

    // Karix API endpoint for sending SMS
    const apiUrl = config.apiUrl || 'https://api.karix.io/message/';
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
    
    const requestBody = {
      channel: ['sms'],
      source: 'ReRide', // Sender ID (must be registered with Karix)
      destination: [phoneNumber],
      content: {
        text: message
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Karix API error: ${response.status} ${response.statusText} - ${errorText}`
      };
    }

    const result = await response.json();
    
    // Check if Karix returned an error in the response
    if (result.error || result.status === 'failed') {
      return {
        success: false,
        error: result.error || result.message || 'Failed to send SMS via Karix'
      };
    }

    return {
      success: true
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send OTP via Karix'
    };
  }
}









