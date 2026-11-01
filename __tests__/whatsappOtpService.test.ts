import { buildWhatsAppOtpBody, toWhatsAppRecipient } from '../services/whatsappOtpService';

describe('whatsapp OTP payload', () => {
  it('sends the code in the body and the copy-code button', () => {
    expect(toWhatsAppRecipient('+919876543210')).toBe('919876543210');
    expect(
      buildWhatsAppOtpBody('919876543210', '123456', {
        templateName: 'reride_login_otp',
        templateLang: 'en',
        copyCodeButton: true,
      }),
    ).toEqual({
      messaging_product: 'whatsapp',
      to: '919876543210',
      type: 'template',
      template: {
        name: 'reride_login_otp',
        language: { code: 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: '123456' }],
          },
        ],
      },
    });
  });

  it('omits the button when the template has none', () => {
    const body = buildWhatsAppOtpBody('919876543210', '123456', {
      templateName: 'reride_login_otp',
      templateLang: 'en',
      copyCodeButton: false,
    });
    const components = (body.template as { components: unknown[] }).components;
    expect(components).toHaveLength(1);
  });
});
