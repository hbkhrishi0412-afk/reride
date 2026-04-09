// Lightweight location data - only major cities and states
export const MAJOR_CITIES = [
  'Mumbai', 'New Delhi', 'Bengaluru', 'Hyderabad', 'Chennai',
  'Pune', 'Ahmedabad', 'Kolkata', 'Jaipur', 'Surat',
  'Lucknow', 'Chandigarh', 'Indore', 'Kochi', 'Guwahati',
  'Bhopal', 'Bhubaneswar', 'Ranchi', 'Patna', 'Visakhapatnam'
];

export const INDIAN_STATES = [
  { name: 'Andaman & Nicobar Islands', code: 'AN' },
  { name: 'Andhra Pradesh', code: 'AP' },
  { name: 'Arunachal Pradesh', code: 'AR' },
  { name: 'Assam', code: 'AS' },
  { name: 'Bihar', code: 'BR' },
  { name: 'Chandigarh', code: 'CH' },
  { name: 'Chhattisgarh', code: 'CG' },
  { name: 'Dadra & Nagar Haveli and Daman & Diu', code: 'DD' },
  { name: 'Delhi', code: 'DL' },
  { name: 'Goa', code: 'GA' },
  { name: 'Gujarat', code: 'GJ' },
  { name: 'Haryana', code: 'HR' },
  { name: 'Himachal Pradesh', code: 'HP' },
  { name: 'Jammu & Kashmir', code: 'JK' },
  { name: 'Jharkhand', code: 'JH' },
  { name: 'Karnataka', code: 'KA' },
  { name: 'Kerala', code: 'KL' },
  { name: 'Ladakh', code: 'LA' },
  { name: 'Lakshadweep', code: 'LD' },
  { name: 'Madhya Pradesh', code: 'MP' },
  { name: 'Maharashtra', code: 'MH' },
  { name: 'Manipur', code: 'MN' },
  { name: 'Meghalaya', code: 'ML' },
  { name: 'Mizoram', code: 'MZ' },
  { name: 'Nagaland', code: 'NL' },
  { name: 'Odisha', code: 'OR' },
  { name: 'Puducherry', code: 'PY' },
  { name: 'Punjab', code: 'PB' },
  { name: 'Rajasthan', code: 'RJ' },
  { name: 'Sikkim', code: 'SK' },
  { name: 'Tamil Nadu', code: 'TN' },
  { name: 'Telangana', code: 'TS' },
  { name: 'Tripura', code: 'TR' },
  { name: 'Uttar Pradesh', code: 'UP' },
  { name: 'Uttarakhand', code: 'UK' },
  { name: 'West Bengal', code: 'WB' }
];

/** Major cities / district towns per state & UT for filters and location picker (pan-India coverage). */
export const CITIES_BY_STATE: Record<string, string[]> = {
  AN: ['Port Blair', 'Diglipur', 'Mayabunder', 'Rangat', 'Car Nicobar'],
  AP: [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore', 'Kurnool', 'Rajahmundry', 'Kakinada',
    'Kadapa', 'Anantapur', 'Ongole', 'Eluru', 'Machilipatnam', 'Vizianagaram', 'Srikakulam', 'Chittoor',
    'Tenali', 'Proddatur', 'Hindupur', 'Bhimavaram', 'Madanapalle', 'Gudivada', 'Nandyal', 'Tadepalligudem',
    'Amaravati', 'Tadipatri', 'Chilakaluripet',
  ],
  AR: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 'Bomdila', 'Tezu', 'Along'],
  AS: [
    'Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Nagaon', 'Tinsukia', 'Tezpur', 'Bongaigaon', 'Dhubri',
    'Goalpara', 'North Lakhimpur', 'Sivasagar', 'Karimganj', 'Hailakandi', 'Golaghat', 'Barpeta',
  ],
  BR: [
    'Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Purnia', 'Darbhanga', 'Begusarai', 'Arrah', 'Katihar',
    'Munger', 'Chhapra', 'Saharsa', 'Sitamarhi', 'Hajipur', 'Siwan', 'Motihari', 'Nawada', 'Buxar',
    'Jehanabad', 'Aurangabad', 'Samastipur',
  ],
  CH: ['Chandigarh'],
  CG: [
    'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon', 'Raigarh', 'Jagdalpur', 'Ambikapur', 'Durg',
    'Bhatapara', 'Dhamtari', 'Chirmiri', 'Mahasamund', 'Janjgir', 'Kanker',
  ],
  DD: ['Daman', 'Diu', 'Silvassa', 'Dadra'],
  DL: [
    'New Delhi', 'Central Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Dwarka',
    'Rohini', 'Pitampura', 'Karol Bagh', 'Lajpat Nagar', 'Vasant Kunj', 'Mayur Vihar',
  ],
  GA: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 'Bicholim', 'Curchorem'],
  GJ: [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand',
    'Bharuch', 'Mehsana', 'Morbi', 'Surendranagar', 'Godhra', 'Nadiad', 'Navsari', 'Vapi', 'Valsad',
    'Bhuj', 'Palanpur', 'Porbandar', 'Veraval', 'Botad', 'Patan',
  ],
  HR: [
    'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar', 'Karnal', 'Sonipat',
    'Panchkula', 'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Rewari', 'Palwal', 'Jind', 'Kaithal', 'Thanesar',
    'Narnaul', 'Hansi',
  ],
  HP: [
    'Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Bilaspur', 'Kullu', 'Chamba', 'Kangra', 'Una',
    'Hamirpur', 'Nahan', 'Palampur', 'Baddi', 'Parwanoo',
  ],
  JK: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Kathua', 'Sopore', 'Rajouri', 'Pulwama', 'Kupwara'],
  JH: [
    'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 'Hazaribagh', 'Giridih', 'Ramgarh',
    'Medininagar', 'Phusro', 'Adityapur', 'Chatra', 'Gumla', 'Lohardaga', 'Simdega', 'Khunti',
  ],
  KA: [
    'Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Kalaburagi', 'Davangere', 'Ballari', 'Vijayapura',
    'Tumakuru', 'Raichur', 'Udupi', 'Chitradurga', 'Kolar', 'Mandya', 'Hassan', 'Shivamogga', 'Bidar',
    'Bagalkot', 'Gadag', 'Haveri', 'Karwar', 'Ramanagara', 'Chikkamagaluru',
  ],
  KL: [
    'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha', 'Palakkad',
    'Malappuram', 'Kottayam', 'Pathanamthitta', 'Idukki', 'Wayanad', 'Kasaragod', 'Vatakara',
  ],
  LA: ['Leh', 'Kargil', 'Diskit', 'Drass'],
  LD: ['Kavaratti', 'Agatti', 'Minicoy', 'Andrott'],
  MP: [
    'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa',
    'Murwara', 'Singrauli', 'Burhanpur', 'Khandwa', 'Chhindwara', 'Shivpuri', 'Mandsaur', 'Neemuch',
    'Hoshangabad', 'Itarsi', 'Vidisha', 'Sehore', 'Morena', 'Bhind',
  ],
  MH: [
    'Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Thane', 'Navi Mumbai', 'Kalyan', 'Vasai-Virar',
    'Pimpri-Chinchwad', 'Amravati', 'Nanded', 'Kolhapur', 'Sangli', 'Malegaon', 'Jalgaon', 'Akola', 'Latur',
    'Ahmednagar', 'Dhule', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Bhusawal', 'Panvel', 'Satara',
    'Ratnagiri', 'Yavatmal', 'Wardha', 'Gondia',
  ],
  MN: ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Ukhrul', 'Senapati'],
  ML: ['Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Williamnagar'],
  MZ: ['Aizawl', 'Lunglei', 'Champhai', 'Saiha', 'Kolasib', 'Serchhip'],
  NL: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Mon', 'Phek'],
  OR: [
    'Bhubaneswar', 'Cuttack', 'Rourkela', 'Brahmapur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Baripada',
    'Jharsuguda', 'Angul', 'Dhenkanal', 'Jeypore', 'Paradip', 'Kendujhar', 'Phulbani', 'Rayagada', 'Titlagarh',
  ],
  PY: ['Puducherry', 'Karaikal', 'Yanam', 'Mahe', 'Ozhukarai'],
  PB: [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Pathankot', 'Mohali', 'Hoshiarpur', 'Batala',
    'Moga', 'Abohar', 'Malerkotla', 'Khanna', 'Phagwara', 'Firozpur', 'Sangrur', 'Rupnagar', 'Kapurthala',
  ],
  RJ: [
    'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar',
    'Pali', 'Sri Ganganagar', 'Tonk', 'Kishangarh', 'Beawar', 'Hanumangarh', 'Dhaulpur', 'Churu', 'Nagaur',
    'Barmer', 'Jaisalmer',
  ],
  SK: ['Gangtok', 'Namchi', 'Mangan', 'Gyalshing', 'Ravangla'],
  TN: [
    'Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli', 'Tirunelveli', 'Thoothukudi', 'Nagercoil',
    'Thanjavur', 'Erode', 'Dindigul', 'Vellore', 'Tiruppur', 'Karaikudi', 'Cuddalore', 'Hosur', 'Kanchipuram',
    'Tiruvannamalai', 'Kumbakonam', 'Ooty', 'Pollachi', 'Rajapalayam', 'Sivakasi',
  ],
  TS: [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 'Khammam', 'Mahbubnagar', 'Nalgonda',
    'Adilabad', 'Secunderabad', 'Mancherial', 'Jagtial', 'Siddipet', 'Kamareddy', 'Sangareddy', 'Medak',
  ],
  TR: ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia', 'Ambassa'],
  UP: [
    'Lucknow', 'Kanpur', 'Noida', 'Varanasi', 'Agra', 'Meerut', 'Prayagraj', 'Bareilly', 'Ghaziabad', 'Gorakhpur',
    'Aligarh', 'Saharanpur', 'Jhansi', 'Moradabad', 'Faizabad', 'Firozabad', 'Mathura', 'Muzaffarnagar',
    'Shahjahanpur', 'Rampur', 'Mirzapur', 'Etawah', 'Budaun', 'Bahraich', 'Jaunpur', 'Lakhimpur', 'Sitapur',
    'Hardoi', 'Raebareli', 'Ayodhya', 'Bulandshahr', 'Amroha', 'Hapur', 'Sambhal',
  ],
  UK: [
    'Dehradun', 'Haridwar', 'Rishikesh', 'Nainital', 'Haldwani', 'Roorkee', 'Rudrapur', 'Kashipur', 'Pithoragarh',
    'Almora', 'Mussoorie', 'Kotdwar', 'Pauri', 'Tehri', 'Udham Singh Nagar',
  ],
  WB: [
    'Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol', 'Bardhaman', 'Malda', 'Kharagpur', 'Baharampur',
    'Haldia', 'Raiganj', 'Jalpaiguri', 'Krishnanagar', 'Bangaon', 'Cooch Behar', 'Alipurduar', 'Darjeeling',
    'Purulia', 'Bankura', 'Midnapore', 'Barasat',
  ],
};

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Mumbai: { lat: 19.0760, lng: 72.8777 },
  'New Delhi': { lat: 28.6139, lng: 77.2090 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Hyderabad: { lat: 17.3850, lng: 78.4867 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Surat: { lat: 21.1702, lng: 72.8311 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Chandigarh: { lat: 30.7333, lng: 76.7794 },
  Indore: { lat: 22.7196, lng: 75.8577 },
  Kochi: { lat: 9.9312, lng: 76.2673 },
  Guwahati: { lat: 26.1445, lng: 91.7362 },
  Bhopal: { lat: 23.2599, lng: 77.4126 },
  Bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  Ranchi: { lat: 23.3441, lng: 85.3096 },
  Patna: { lat: 25.5941, lng: 85.1376 },
  Visakhapatnam: { lat: 17.6868, lng: 83.2185 }
};
