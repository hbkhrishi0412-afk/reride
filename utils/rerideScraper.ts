// utils/rerideScraper.ts

export interface CarMake {
  name: string;
  logo: string;
  models: CarModel[];
}

export interface CarModel {
  name: string;
  variants: string[];
}

export interface ScrapedCarData {
  makes: CarMake[];
}

// Comprehensive car data extracted from Reride and other sources
export const getCarData = (): ScrapedCarData => {
  return {
    makes: [
      {
        name: 'Maruti Suzuki',
        logo: '🚗',
        models: [
          { name: 'Swift', variants: ['LXi', 'VXi', 'ZXi', 'ZXi+', 'AMT'] },
          { name: 'Baleno', variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'] },
          { name: 'Dzire', variants: ['LXi', 'VXi', 'ZXi', 'ZXi+'] },
          { name: 'Alto K10', variants: ['Std', 'LXi', 'VXi', 'VXi+'] },
          { name: 'Wagon R', variants: ['LXi', 'VXi', 'ZXi'] },
          { name: 'Celerio', variants: ['LXi', 'VXi', 'ZXi'] },
          { name: 'Ertiga', variants: ['LXi', 'VXi', 'ZXi', 'ZXi+'] },
          { name: 'Vitara Brezza', variants: ['LDi', 'VDi', 'ZDi', 'ZDi+'] },
          { name: 'S-Cross', variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'] },
          { name: 'Ignis', variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'] }
        ]
      },
      {
        name: 'Hyundai',
        logo: '🚙',
        models: [
          { name: 'Creta', variants: ['E', 'EX', 'S', 'SX', 'SX(O)'] },
          { name: 'Venue', variants: ['E', 'S', 'S+', 'SX', 'SX(O)'] },
          { name: 'i20', variants: ['Magna', 'Sportz', 'Asta', 'Asta(O)'] },
          { name: 'Grand i10', variants: ['Magna', 'Sportz', 'Asta'] },
          { name: 'i10', variants: ['Magna', 'Sportz', 'Asta'] },
          { name: 'Elantra', variants: ['S', 'SX', 'SX(O)'] },
          { name: 'Verna', variants: ['S', 'SX', 'SX(O)'] },
          { name: 'Tucson', variants: ['GLS', 'GLS(O)', 'GLS(O) AT'] },
          { name: 'Kona Electric', variants: ['Premium'] },
          { name: 'Aura', variants: ['Magna', 'Sportz', 'Asta'] }
        ]
      },
      {
        name: 'Tata',
        logo: '🚘',
        models: [
          { name: 'Nexon', variants: ['XE', 'XM', 'XMS', 'XMA', 'XZ+', 'XZA+'] },
          { name: 'Punch', variants: ['Pure', 'Adventure', 'Accomplished', 'Creative'] },
          { name: 'Tiago', variants: ['XE', 'XM', 'XT', 'XZ', 'XZ+'] },
          { name: 'Tigor', variants: ['XE', 'XM', 'XZ', 'XZ+'] },
          { name: 'Altroz', variants: ['XE', 'XM', 'XZ', 'XZ+'] },
          { name: 'Harrier', variants: ['XE', 'XM', 'XZ', 'XZ+'] },
          { name: 'Safari', variants: ['XE', 'XM', 'XZ', 'XZ+'] },
          { name: 'Hexa', variants: ['XE', 'XM', 'XZ', 'XZ+'] },
          { name: 'Zest', variants: ['XE', 'XM', 'XZ', 'XZ+'] },
          { name: 'Bolt', variants: ['XE', 'XM', 'XZ', 'XZ+'] }
        ]
      },
      {
        name: 'Honda',
        logo: '🚗',
        models: [
          { name: 'City', variants: ['V', 'VX', 'ZX'] },
          { name: 'Amaze', variants: ['E', 'S', 'V', 'VX'] },
          { name: 'Jazz', variants: ['E', 'S', 'V', 'VX'] },
          { name: 'WR-V', variants: ['E', 'S', 'V', 'VX'] },
          { name: 'Civic', variants: ['V', 'VX', 'ZX'] },
          { name: 'CR-V', variants: ['V', 'VX', 'ZX'] },
          { name: 'Accord', variants: ['V', 'VX', 'ZX'] },
          { name: 'BR-V', variants: ['E', 'S', 'V', 'VX'] },
          { name: 'Brio', variants: ['E', 'S', 'V', 'VX'] },
          { name: 'Mobilio', variants: ['E', 'S', 'V', 'VX'] }
        ]
      },
      {
        name: 'Renault',
        logo: '🏎️',
        models: [
          { name: 'Kiger', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Kwid', variants: ['RXL', 'RXT', 'Climber'] },
          { name: 'Triber', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Duster', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Lodgy', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Captur', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Pulse', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Fluence', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Scala', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] },
          { name: 'Koleos', variants: ['RXE', 'RXL', 'RXT', 'RXZ'] }
        ]
      },
      {
        name: 'Mahindra',
        logo: '🚚',
        models: [
          { name: 'XUV700', variants: ['MX', 'AX3', 'AX5', 'AX7'] },
          { name: 'Thar', variants: ['AX Opt', 'LX'] },
          { name: 'Scorpio', variants: ['S2', 'S4', 'S6', 'S8'] },
          { name: 'Bolero', variants: ['B4', 'B6', 'B6 Plus'] },
          { name: 'XUV300', variants: ['W4', 'W6', 'W8'] },
          { name: 'Marazzo', variants: ['M2', 'M4', 'M6', 'M8'] },
          { name: 'TUV300', variants: ['T4', 'T6', 'T8'] },
          { name: 'KUV100', variants: ['K2', 'K4', 'K6', 'K8'] },
          { name: 'Verito', variants: ['D2', 'D4', 'D6'] },
          { name: 'Xylo', variants: ['E2', 'E4', 'E6', 'E8'] }
        ]
      },
      {
        name: 'Kia',
        logo: '🚐',
        models: [
          { name: 'Seltos', variants: ['HTE', 'HTK', 'HTX', 'GTX', 'X-Line'] },
          { name: 'Sonet', variants: ['HTE', 'HTK', 'HTX', 'GTX'] },
          { name: 'Carnival', variants: ['Premium', 'Prestige', 'Limousine'] },
          { name: 'EV6', variants: ['GT Line', 'GT Line AWD'] },
          { name: 'Carens', variants: ['Premium', 'Prestige', 'Luxury'] },
          { name: 'Stonic', variants: ['HTE', 'HTK', 'HTX'] },
          { name: 'Rio', variants: ['HTE', 'HTK', 'HTX'] },
          { name: 'Optima', variants: ['GT Line', 'GT Line AWD'] },
          { name: 'Cadenza', variants: ['Premium', 'Luxury'] },
          { name: 'Sorento', variants: ['GT Line', 'GT Line AWD'] }
        ]
      },
      {
        name: 'Toyota',
        logo: '🚌',
        models: [
          { name: 'Fortuner', variants: ['2.7 Petrol', '2.8 Diesel'] },
          { name: 'Innova Crysta', variants: ['G', 'GX', 'VX', 'ZX'] },
          { name: 'Camry', variants: ['Hybrid'] },
          { name: 'Corolla Altis', variants: ['G', 'GX', 'VX', 'ZX'] },
          { name: 'Etios', variants: ['G', 'GX', 'VX'] },
          { name: 'Etios Liva', variants: ['G', 'GX', 'VX'] },
          { name: 'Prius', variants: ['Hybrid'] },
          { name: 'Land Cruiser', variants: ['Prado', '200'] },
          { name: 'Yaris', variants: ['G', 'GX', 'VX', 'ZX'] },
          { name: 'Glanza', variants: ['G', 'GX', 'VX', 'ZX'] }
        ]
      },
      {
        name: 'Volkswagen',
        logo: '🚓',
        models: [
          { name: 'Virtus', variants: ['Comfortline', 'Highline', 'Topline', 'GT Plus'] },
          { name: 'Taigun', variants: ['Comfortline', 'Highline', 'Topline', 'GT Plus'] },
          { name: 'Polo', variants: ['Comfortline', 'Highline', 'Topline', 'GT'] },
          { name: 'Vento', variants: ['Comfortline', 'Highline', 'Topline', 'GT'] },
          { name: 'Passat', variants: ['Comfortline', 'Highline', 'Topline'] },
          { name: 'Tiguan', variants: ['Comfortline', 'Highline', 'Topline'] },
          { name: 'Jetta', variants: ['Comfortline', 'Highline', 'Topline'] },
          { name: 'Beetle', variants: ['Design', 'Sport'] },
          { name: 'Touareg', variants: ['Comfortline', 'Highline', 'Topline'] },
          { name: 'Ameo', variants: ['Comfortline', 'Highline', 'Topline'] }
        ]
      },
      {
        name: 'Skoda',
        logo: '🚕',
        models: [
          { name: 'Slavia', variants: ['Active', 'Ambition', 'Style'] },
          { name: 'Kushaq', variants: ['Active', 'Ambition', 'Style'] },
          { name: 'Octavia', variants: ['Ambition', 'Style', 'Laurin & Klement'] },
          { name: 'Superb', variants: ['Ambition', 'Style', 'Laurin & Klement'] },
          { name: 'Rapid', variants: ['Ambition', 'Style'] },
          { name: 'Kodiaq', variants: ['Ambition', 'Style', 'Laurin & Klement'] },
          { name: 'Karoq', variants: ['Ambition', 'Style'] },
          { name: 'Fabia', variants: ['Ambition', 'Style'] },
          { name: 'Yeti', variants: ['Ambition', 'Style'] },
          { name: 'Laura', variants: ['Ambition', 'Style'] }
        ]
      },
      {
        name: 'MG',
        logo: '🚜',
        models: [
          { name: 'Hector', variants: ['Style', 'Super', 'Sharp', 'Smart'] },
          { name: 'Gloster', variants: ['Super', 'Sharp', 'Smart'] },
          { name: 'ZS EV', variants: ['Excite', 'Exclusive'] },
          { name: 'Astor', variants: ['Style', 'Super', 'Sharp', 'Smart'] },
          { name: 'Comet', variants: ['Style', 'Super', 'Sharp'] },
          { name: 'Hector Plus', variants: ['Style', 'Super', 'Sharp', 'Smart'] },
          { name: 'ZS', variants: ['Style', 'Super', 'Sharp'] },
          { name: 'RX5', variants: ['Style', 'Super', 'Sharp'] },
          { name: 'RX8', variants: ['Style', 'Super', 'Sharp'] },
          { name: 'HS', variants: ['Style', 'Super', 'Sharp'] }
        ]
      },
      {
        name: 'Nissan',
        logo: '🚛',
        models: [
          { name: 'Magnite', variants: ['XE', 'XL', 'XV', 'XV Premium'] },
          { name: 'Kicks', variants: ['XL', 'XV', 'XV Premium'] },
          { name: 'Micra', variants: ['XL', 'XV', 'XV Premium'] },
          { name: 'Sunny', variants: ['XL', 'XV', 'XV Premium'] },
          { name: 'Terrano', variants: ['XL', 'XV', 'XV Premium'] },
          { name: 'Datsun GO', variants: ['XL', 'XV', 'XV Premium'] },
          { name: 'Datsun GO+', variants: ['XL', 'XV', 'XV Premium'] },
          { name: 'Datsun Redi-GO', variants: ['XL', 'XV', 'XV Premium'] },
          { name: 'GT-R', variants: ['Premium'] },
          { name: '370Z', variants: ['Premium'] }
        ]
      },
      {
        name: 'Ford',
        logo: '🚔',
        models: [
          { name: 'EcoSport', variants: ['Ambiente', 'Trend', 'Titanium', 'Titanium+'] },
          { name: 'Endeavour', variants: ['Trend', 'Titanium', 'Titanium+'] },
          { name: 'Figo', variants: ['Ambiente', 'Trend', 'Titanium'] },
          { name: 'Aspire', variants: ['Ambiente', 'Trend', 'Titanium'] },
          { name: 'Freestyle', variants: ['Ambiente', 'Trend', 'Titanium'] },
          { name: 'Mustang', variants: ['GT'] },
          { name: 'Fiesta', variants: ['Ambiente', 'Trend', 'Titanium'] },
          { name: 'Mondeo', variants: ['Trend', 'Titanium'] },
          { name: 'Focus', variants: ['Trend', 'Titanium'] },
          { name: 'Territory', variants: ['Trend', 'Titanium'] }
        ]
      },
      {
        name: 'BMW',
        logo: '⭐',
        models: [
          { name: '3 Series', variants: ['320d', '330i', 'M340i'] },
          { name: '5 Series', variants: ['520d', '530i', 'M550i'] },
          { name: '7 Series', variants: ['730Ld', '740Li', '750Li'] },
          { name: 'X1', variants: ['sDrive20i', 'xDrive20d'] },
          { name: 'X3', variants: ['xDrive20d', 'xDrive30i', 'M40i'] },
          { name: 'X5', variants: ['xDrive30d', 'xDrive40i', 'M50i'] },
          { name: 'X7', variants: ['xDrive30d', 'xDrive40i', 'M50i'] },
          { name: 'Z4', variants: ['sDrive20i', 'sDrive30i', 'M40i'] },
          { name: 'iX', variants: ['xDrive40', 'xDrive50'] },
          { name: 'i4', variants: ['eDrive40', 'M50'] }
        ]
      },
      {
        name: 'Mercedes-Benz',
        logo: '⭐',
        models: [
          { name: 'A-Class', variants: ['A200', 'A250', 'AMG A35'] },
          { name: 'C-Class', variants: ['C200', 'C300', 'AMG C43'] },
          { name: 'E-Class', variants: ['E200', 'E300', 'AMG E53'] },
          { name: 'S-Class', variants: ['S350d', 'S450', 'S560'] },
          { name: 'GLA', variants: ['GLA200', 'GLA250', 'AMG GLA35'] },
          { name: 'GLC', variants: ['GLC200', 'GLC300', 'AMG GLC43'] },
          { name: 'GLE', variants: ['GLE300d', 'GLE450', 'AMG GLE53'] },
          { name: 'GLS', variants: ['GLS400d', 'GLS450', 'AMG GLS63'] },
          { name: 'EQC', variants: ['EQC400'] },
          { name: 'EQS', variants: ['EQS450', 'EQS580'] }
        ]
      },
      {
        name: 'Audi',
        logo: '🚗',
        models: [
          { name: 'A3', variants: ['35 TFSI', '40 TFSI', 'S3'] },
          { name: 'A4', variants: ['35 TDI', '40 TFSI', 'S4'] },
          { name: 'A6', variants: ['40 TDI', '45 TFSI', 'S6'] },
          { name: 'A8', variants: ['50 TDI', '55 TFSI', 'S8'] },
          { name: 'Q2', variants: ['35 TFSI', '40 TFSI'] },
          { name: 'Q3', variants: ['35 TDI', '40 TFSI', 'RS Q3'] },
          { name: 'Q5', variants: ['40 TDI', '45 TFSI', 'SQ5'] },
          { name: 'Q7', variants: ['45 TDI', '55 TFSI', 'SQ7'] },
          { name: 'Q8', variants: ['45 TDI', '55 TFSI', 'RS Q8'] },
          { name: 'e-tron', variants: ['50', '55', 'GT'] }
        ]
      },
      {
        name: 'Volvo',
        logo: '🚌',
        models: [
          { name: 'XC40', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'XC60', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'XC90', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'S60', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'S90', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'V40', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'V60', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'V90', variants: ['Momentum', 'R-Design', 'Inscription'] },
          { name: 'C30', variants: ['Momentum', 'R-Design'] },
          { name: 'C70', variants: ['Momentum', 'R-Design'] }
        ]
      },
      {
        name: 'Jeep',
        logo: '🚋',
        models: [
          { name: 'Compass', variants: ['Sport', 'Longitude', 'Limited', 'Trailhawk'] },
          { name: 'Wrangler', variants: ['Sport', 'Sahara', 'Rubicon'] },
          { name: 'Grand Cherokee', variants: ['Laredo', 'Limited', 'Overland', 'SRT'] },
          { name: 'Renegade', variants: ['Sport', 'Longitude', 'Limited', 'Trailhawk'] },
          { name: 'Cherokee', variants: ['Sport', 'Longitude', 'Limited', 'Trailhawk'] },
          { name: 'Gladiator', variants: ['Sport', 'Overland', 'Rubicon'] },
          { name: 'Commander', variants: ['Sport', 'Longitude', 'Limited'] },
          { name: 'Avenger', variants: ['Sport', 'Longitude', 'Limited'] },
          { name: 'Patriot', variants: ['Sport', 'Longitude', 'Limited'] },
          { name: 'Liberty', variants: ['Sport', 'Longitude', 'Limited'] }
        ]
      },
      {
        name: 'Land Rover',
        logo: '🚌',
        models: [
          { name: 'Range Rover', variants: ['P360', 'P400', 'P530'] },
          { name: 'Range Rover Sport', variants: ['P360', 'P400', 'P530'] },
          { name: 'Range Rover Evoque', variants: ['P200', 'P250', 'P300'] },
          { name: 'Range Rover Velar', variants: ['P250', 'P300', 'P400'] },
          { name: 'Discovery Sport', variants: ['P200', 'P250', 'P300'] },
          { name: 'Discovery', variants: ['P300', 'P360', 'P400'] },
          { name: 'Defender', variants: ['P200', 'P300', 'P400'] },
          { name: 'Freelander', variants: ['TD4', 'Si4'] },
          { name: 'LR2', variants: ['SE', 'HSE'] },
          { name: 'LR3', variants: ['SE', 'HSE'] }
        ]
      },
      {
        name: 'Porsche',
        logo: '🏎️',
        models: [
          { name: '911', variants: ['Carrera', 'Carrera S', 'Carrera 4S', 'Turbo S'] },
          { name: '718', variants: ['Cayman', 'Boxster', 'Cayman S', 'Boxster S'] },
          { name: 'Macan', variants: ['Macan', 'Macan S', 'Macan GTS', 'Macan Turbo'] },
          { name: 'Cayenne', variants: ['Cayenne', 'Cayenne S', 'Cayenne GTS', 'Cayenne Turbo'] },
          { name: 'Panamera', variants: ['Panamera', 'Panamera S', 'Panamera GTS', 'Panamera Turbo'] },
          { name: 'Taycan', variants: ['Taycan', 'Taycan 4S', 'Taycan Turbo', 'Taycan Turbo S'] },
          { name: 'Cayman', variants: ['Cayman', 'Cayman S', 'Cayman GTS'] },
          { name: 'Boxster', variants: ['Boxster', 'Boxster S', 'Boxster GTS'] },
          { name: 'Carrera GT', variants: ['GT'] },
          { name: '918 Spyder', variants: ['Spyder'] }
        ]
      },
      {
        name: 'Mini',
        logo: '🚘',
        models: [
          { name: 'Cooper', variants: ['Cooper', 'Cooper S', 'Cooper SE'] },
          { name: 'Countryman', variants: ['Cooper', 'Cooper S', 'Cooper SE'] },
          { name: 'Clubman', variants: ['Cooper', 'Cooper S', 'Cooper SE'] },
          { name: 'Convertible', variants: ['Cooper', 'Cooper S'] },
          { name: 'Hardtop', variants: ['Cooper', 'Cooper S', 'Cooper SE'] },
          { name: 'Paceman', variants: ['Cooper', 'Cooper S'] },
          { name: 'Roadster', variants: ['Cooper', 'Cooper S'] },
          { name: 'Coupe', variants: ['Cooper', 'Cooper S'] },
          { name: 'John Cooper Works', variants: ['JCW'] },
          { name: 'GP', variants: ['GP'] }
        ]
      },
      {
        name: 'Mitsubishi',
        logo: '🚙',
        models: [
          { name: 'Outlander', variants: ['ES', 'SE', 'GT'] },
          { name: 'Eclipse Cross', variants: ['ES', 'SE', 'GT'] },
          { name: 'Mirage', variants: ['ES', 'SE', 'GT'] },
          { name: 'Lancer', variants: ['ES', 'SE', 'GT'] },
          { name: 'Galant', variants: ['ES', 'SE', 'GT'] },
          { name: 'Endeavor', variants: ['ES', 'SE', 'GT'] },
          { name: 'Montero', variants: ['ES', 'SE', 'GT'] },
          { name: 'Diamante', variants: ['ES', 'SE', 'GT'] },
          { name: 'Expo', variants: ['ES', 'SE', 'GT'] },
          { name: 'Mighty Max', variants: ['ES', 'SE', 'GT'] }
        ]
      }
    ]
  };
};

// Function to simulate web scraping delay
export const simulateScrapingDelay = (ms: number = 1000): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Function to get car data with simulated scraping
export const fetchCarDataFromReride = async (): Promise<ScrapedCarData> => {
  console.log('🔍 Simulating web scraping from Reride...');
  await simulateScrapingDelay(1500);
  
  const data = getCarData();
  console.log('✅ Successfully extracted car data:', data.makes.length, 'makes found');
  
  return data;
};

// Helper functions for filtering
export const getModelsByMake = (make: string, carData: ScrapedCarData): CarModel[] => {
  const makeData = carData.makes.find(m => m.name === make);
  return makeData ? makeData.models : [];
};

export const getVariantsByModel = (make: string, model: string, carData: ScrapedCarData): string[] => {
  const makeData = carData.makes.find(m => m.name === make);
  if (!makeData) return [];
  
  const modelData = makeData.models.find(m => m.name === model);
  return modelData ? modelData.variants : [];
};

// Indian districts/cities for location selection
export const getIndianDistricts = (): string[] => {
  return [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad',
    'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam',
    'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik',
    'Faridabad', 'Meerut', 'Rajkot', 'Kalyan-Dombivali', 'Vasai-Virar', 'Varanasi', 'Srinagar',
    'Aurangabad', 'Navi Mumbai', 'Solapur', 'Vijayawada', 'Kolhapur', 'Amravati', 'Noida',
    'Ranchi', 'Howrah', 'Coimbatore', 'Raipur', 'Gwalior', 'Chandigarh', 'Tiruchirappalli',
    'Mysore', 'Bhubaneswar', 'Kochi', 'Bhavnagar', 'Salem', 'Warangal', 'Guntur', 'Bhiwandi',
    'Amritsar', 'Nanded', 'Kolhapur', 'Sangli', 'Malegaon', 'Ulhasnagar', 'Jalgaon', 'Akola',
    'Latur', 'Ahmadnagar', 'Dhule', 'Ichalkaranji', 'Parbhani', 'Jalna', 'Bhusawal', 'Satara',
    'Beed', 'Yavatmal', 'Kamptee', 'Gondia', 'Barshi', 'Achalpur', 'Osmanabad', 'Nandurbar',
    'Wardha', 'Udgir', 'Aurangabad', 'Amalner', 'Akot', 'Pandharpur', 'Shrirampur', 'Parli',
    'Washim', 'Pathri', 'Sangamner', 'Shirpur', 'Malkapur', 'Amalner', 'Dhule', 'Ichalkaranji'
  ];
};

// Years from 2025 to 1990
export const getCarYears = (): string[] => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  
  for (let year = currentYear + 1; year >= 1990; year--) {
    years.push(year.toString());
  }
  
  return years;
};

// Ownership options
export const getOwnershipOptions = (): string[] => {
  return ['1st Owner', '2nd Owner', '3rd Owner', '4th Owner', '5th+ Owner'];
};
