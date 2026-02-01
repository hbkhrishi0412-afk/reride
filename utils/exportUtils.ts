/**
 * Export utilities for website-only features
 * Provides CSV/Excel export functionality for vehicles and data
 */

export interface ExportableVehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  variant?: string;
  price: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  status: string;
  views?: number;
  inquiriesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Convert array of vehicles to CSV format
 */
export function vehiclesToCSV(vehicles: ExportableVehicle[]): string {
  if (vehicles.length === 0) return '';

  const headers = [
    'ID',
    'Make',
    'Model',
    'Year',
    'Variant',
    'Price',
    'Mileage',
    'Fuel Type',
    'Transmission',
    'Status',
    'Views',
    'Inquiries',
    'Created At',
    'Updated At'
  ];

  const rows = vehicles.map(vehicle => [
    vehicle.id.toString(),
    vehicle.make || '',
    vehicle.model || '',
    vehicle.year?.toString() || '',
    vehicle.variant || '',
    vehicle.price?.toString() || '0',
    vehicle.mileage?.toString() || '0',
    vehicle.fuelType || '',
    vehicle.transmission || '',
    vehicle.status || '',
    vehicle.views?.toString() || '0',
    vehicle.inquiriesCount?.toString() || '0',
    vehicle.createdAt || '',
    vehicle.updatedAt || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV file to vehicles array
 */
export function parseCSVToVehicles(csvContent: string): ExportableVehicle[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const vehicles: ExportableVehicle[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    
    if (values.length < headers.length) continue;

    const vehicle: Partial<ExportableVehicle> = {};
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      switch (header.toLowerCase()) {
        case 'id':
          vehicle.id = parseInt(value) || 0;
          break;
        case 'make':
          vehicle.make = value;
          break;
        case 'model':
          vehicle.model = value;
          break;
        case 'year':
          vehicle.year = parseInt(value) || 0;
          break;
        case 'variant':
          vehicle.variant = value;
          break;
        case 'price':
          vehicle.price = parseFloat(value) || 0;
          break;
        case 'mileage':
          vehicle.mileage = parseInt(value) || 0;
          break;
        case 'fuel type':
          vehicle.fuelType = value;
          break;
        case 'transmission':
          vehicle.transmission = value;
          break;
        case 'status':
          vehicle.status = value;
          break;
        case 'views':
          vehicle.views = parseInt(value) || 0;
          break;
        case 'inquiries':
          vehicle.inquiriesCount = parseInt(value) || 0;
          break;
        case 'created at':
          vehicle.createdAt = value;
          break;
        case 'updated at':
          vehicle.updatedAt = value;
          break;
      }
    });

    if (vehicle.id && vehicle.make && vehicle.model) {
      vehicles.push(vehicle as ExportableVehicle);
    }
  }

  return vehicles;
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}







