import React from 'react';
import { render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { VehicleJsonLd } from '../components/VehicleJsonLd';
import { VehicleCategory } from '../vehicle-category';

const vehicle = {
  id: 7,
  make: 'Tata',
  model: 'Nexon',
  year: 2022,
  price: 800000,
  mileage: 15000,
  category: VehicleCategory.FOUR_WHEELER,
  images: ['https://cdn.example.com/nexon.jpg'],
} as const;

describe('VehicleJsonLd', () => {
  it('renders application/ld+json scripts', () => {
    render(
      <HelmetProvider>
        <VehicleJsonLd vehicle={vehicle as never} />
      </HelmetProvider>,
    );
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(scripts[0].textContent || '{}');
    expect(parsed['@type']).toBe('Organization');
  });
});
