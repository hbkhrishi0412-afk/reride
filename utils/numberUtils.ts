/**
 * Number formatting utility functions for Indian number system (lakhs/crores)
 */

/**
 * Formats a number to lakhs or crores when it exceeds card boundaries
 * @param value - The number to format
 * @param maxLength - Maximum character length before converting to lakhs/crores (default: 8)
 * @returns Formatted string in lakhs or crores format if exceeds threshold, otherwise formatted with commas
 */
export const formatSalesValue = (value: number, maxLength: number = 8): string => {
  if (!value || value === 0) return '₹0';
  
  // Format with Indian locale to get comma-separated number
  const formatted = `₹${value.toLocaleString('en-IN')}`;
  
  // If the formatted string length exceeds maxLength, convert to lakhs/crores
  if (formatted.length > maxLength) {
    if (value >= 10000000) {
      // Convert to crores (1 crore = 10,000,000)
      const crores = value / 10000000;
      return `₹${crores.toFixed(2)} Cr`;
    } else if (value >= 100000) {
      // Convert to lakhs (1 lakh = 100,000)
      const lakhs = value / 100000;
      return `₹${lakhs.toFixed(2)} L`;
    }
  }
  
  // Return formatted number with commas if it fits within maxLength
  return formatted;
};
