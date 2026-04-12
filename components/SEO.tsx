/**
 * Per-page SEO: title, description, Open Graph, Twitter Card.
 * Use with react-helmet-async. Base URL is configurable via VITE_APP_URL.
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';

const BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL
  ? import.meta.env.VITE_APP_URL
  : 'https://www.reride.co.in';

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
  type?: 'website' | 'article';
  price?: number;
  currency?: string;
  vehicleName?: string;
  noIndex?: boolean;
  /** JSON-LD objects (Organization, Product/Vehicle, etc.) */
  jsonLd?: Record<string, unknown>[];
}

export default function SEO({
  title,
  description,
  image,
  path = '/',
  type = 'website',
  price,
  currency = 'INR',
  vehicleName,
  noIndex = false,
  jsonLd,
}: SEOProps) {
  const fullTitle = title ? `${title} | ReRide` : 'ReRide - Buy & Sell Quality Used Vehicles';
  const fullDescription = description || 'Buy and sell quality used vehicles with confidence. AI-powered recommendations and certified inspections.';
  const canonical = path.startsWith('http') ? path : `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
  const imageUrl = image && (image.startsWith('http') || image.startsWith('data:')) ? image : image ? `${BASE_URL}${image.startsWith('/') ? image : '/' + image}` : `${BASE_URL}/icon-512.png`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical" href={canonical} />
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="ReRide" />
      {price != null && <meta property="product:price:amount" content={String(price)} />}
      {currency && <meta property="product:price:currency" content={currency} />}
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={imageUrl} />
      {vehicleName && <meta name="twitter:label1" content="Vehicle" />}
      {vehicleName && <meta name="twitter:data1" content={vehicleName} />}
      {jsonLd?.map((schema, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
