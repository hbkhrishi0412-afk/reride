import React from 'react';
import { MobileFilterSheet } from './MobileFilterSheet';
import EMICalculator from './EMICalculator';

interface MobileEMICalculatorProps {
  price: number;
  onClose: () => void;
}

/**
 * Mobile EMI Calculator bottom sheet — reuses EMICalculator with touch-friendly sliders.
 */
export const MobileEMICalculator: React.FC<MobileEMICalculatorProps> = ({ price, onClose }) => {
  return (
    <MobileFilterSheet isOpen onClose={onClose} title="EMI Calculator">
      <EMICalculator principal={price} embedded />
    </MobileFilterSheet>
  );
};

export default MobileEMICalculator;
