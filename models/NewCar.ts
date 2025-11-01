import mongoose from 'mongoose';

const newCarVariantSchema = new mongoose.Schema({
  variant_name: { type: String, required: true },
  engine_specs: { type: String, required: true },
  fuel_type: { type: String, enum: ['Petrol', 'Diesel', 'CNG', 'Electric/EV', 'Hybrid'], required: true },
  transmission: { type: String, enum: ['Manual', 'Automatic', 'AMT', 'CVT', 'DCT', 'e-CVT'], required: true },
  power_bhp: { type: String, required: true },
  torque_nm: { type: String, required: true },
  on_road_prices: { type: mongoose.Schema.Types.Mixed, required: true },
  features: {
    safety: [String],
    comfort_convenience: [String],
    interior: [String],
    exterior: [String]
  }
});

const newCarSchema = new mongoose.Schema({
  brand_name: { type: String, required: true, index: true },
  model_name: { type: String, required: true, index: true },
  model_year: { type: Number, required: true, index: true },
  body_type: { type: String, enum: ['SUV', 'Sedan', 'Hatchback', 'MUV'], required: true },
  overview: { type: String },
  key_specs: {
    engine: { type: String, required: true },
    mileage: { type: String, required: true },
    power: { type: String, required: true },
    seating_capacity: { type: Number, required: true },
    safety_rating_stars: { type: Number },
    boot_space_litres: { type: Number }
  },
  fuel_options: [{ type: String, enum: ['Petrol', 'Diesel', 'CNG', 'Electric/EV', 'Hybrid'], required: true }],
  variants: [newCarVariantSchema],
  image_url: { type: String, required: true },
  gallery_images: [String],
  brochure_url: { type: String },
  monthly_sales: { type: Number, default: 0 },
  starting_price: { type: Number },
  emi: {
    downPayment: { type: Number, default: 0 },
    interestRate: { type: Number, default: 10 },
    tenureMonths: { type: Number, default: 60 }
  },
  faqs: [{ question: String, answer: String }],
}, {
  timestamps: true
});

const NewCarModel = mongoose.models.NewCar || mongoose.model('NewCar', newCarSchema);

export default NewCarModel;

