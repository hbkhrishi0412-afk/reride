import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import type { Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import { buildVehicleDetailJsonLd } from '../utils/vehicleJsonLd';

interface VehicleJsonLdProps {
  vehicle: Vehicle;
}

/** In-page JSON-LD for vehicle detail — complements app-level SEO meta. */
export function VehicleJsonLd({ vehicle }: VehicleJsonLdProps) {
  const schemas = useMemo(() => {
    const img = getFirstValidImage(vehicle.images, vehicle.id);
    return buildVehicleDetailJsonLd(vehicle, img);
  }, [vehicle]);

  return (
    <Helmet>
      {schemas.map((schema, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

export default VehicleJsonLd;
