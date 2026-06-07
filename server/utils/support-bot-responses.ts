/** Rule-based support bot replies (migrated from api/chat-websocket.js). */
export async function generateBotResponse(userMessage: string, userName: string): Promise<string> {
  const message = userMessage.toLowerCase();
  const name = userName || 'Guest';

  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    return `Hello ${name}! 👋 How can I help you today?`;
  }
  if (message.includes('price') || message.includes('cost')) {
    return 'Our prices vary based on the vehicle. Could you tell me which vehicle you\'re interested in?';
  }
  if (message.includes('contact') || message.includes('phone') || message.includes('email')) {
    return 'You can reach us at support@reride.com. Our support team is available 24/7!';
  }
  if (message.includes('help') || message.includes('support')) {
    return 'I\'m here to help! You can ask me about vehicles, pricing, registration, or any other questions.';
  }
  if (message.includes('thank')) {
    return 'You\'re welcome! Is there anything else I can help you with?';
  }
  return `Thank you for your message, ${name}! Our support team will get back to you shortly.`;
}
