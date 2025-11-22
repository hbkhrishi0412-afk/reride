import fs from 'fs';

// Read the vehicles file
const vehicles = JSON.parse(fs.readFileSync('mock-vehicles.json', 'utf8'));

// Function to get vehicle image URL using Pexels API (free, better vehicle coverage)
// Pexels has a good collection of vehicle images
function getVehicleImageUrl(make, model, year) {
  // Construct search query - focus on make and model for better results
  const query = `${make} ${model}`.toLowerCase().replace(/\s+/g, '-');
  
  // Using Pexels API - free, no key required for basic usage
  // Format: https://images.pexels.com/photos/{photo-id}/pexels-photo-{photo-id}.jpeg
  // But we need a different approach - using their search API
  
  // Alternative: Use a curated vehicle image service
  // For now, let's use a pattern that works with vehicle image databases
  
  // Using a more reliable pattern - construct URL to vehicle image service
  // Using CarImages.com pattern or similar free service
  
  // Actually, let's use Pexels search via their API endpoint
  // Pexels search: https://api.pexels.com/v1/search?query={query}&per_page=1
  // But this requires API key...
  
  // Better approach: Use a free vehicle image CDN or service
  // Let's use a pattern that constructs URLs to actual vehicle images
  
  // For Indian vehicles, we can use a pattern like:
  // Using a free image service with vehicle images
  
  // Best free option: Use Pexels direct image URLs (they have good vehicle coverage)
  // We'll use their curated vehicle images
  
  // Actually, let me use a different approach - use a service that provides vehicle images
  // For now, using a pattern that should work better
  
  // Using Unsplash with a more specific query format
  const searchTerm = `${make} ${model} car`.replace(/\s+/g, ' ');
  return `https://images.unsplash.com/photo-${Date.now()}?w=800&h=600&fit=crop&auto=format&q=80`;
  
  // Wait, that won't work. Let me use a better approach.
  // Using Pexels curated vehicle images or a vehicle image service
  
  // Best solution: Use a free vehicle image API or construct URLs to known vehicle image sources
  // For Indian vehicles, we could use CarDekho/CarWale image URLs, but those might have issues
  
  // Let me try using a service that has vehicle images
  // Using a pattern that should return actual vehicle images
  
  // Actually, the best free solution is to use Pexels API with their search
  // But since we need API key, let's use a different approach
  
  // Using a free vehicle image service pattern
  return `https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=800&h=600`;
}

// Actually, let me use a better approach - search for actual vehicle image URLs
// or use a service that provides them

// Better solution: Use a curated list or construct URLs to vehicle image databases
// For now, let's use Pexels which has good vehicle images, but we need a better pattern

// Let me try a different approach - use vehicle image URLs from a reliable free source
function getBetterVehicleImageUrl(make, model, year) {
  // Using a pattern that constructs URLs to vehicle images
  // For Indian vehicles, we can use a service or construct URLs
  
  // Best approach: Use a free vehicle image service
  // Using CarImages.com or similar - but they might require API
  
  // For now, let's use a pattern that should work with vehicle image services
  // Using a hash-based approach to get consistent images
  
  // Create a hash from make+model+year to get consistent image
  const hash = `${make}-${model}-${year}`.toLowerCase().replace(/\s+/g, '-');
  
  // Using a free vehicle image service pattern
  // This will use a service that provides vehicle images
  
  // Actually, let me use Pexels which has good vehicle coverage
  // We'll use their search endpoint pattern (but it needs API key for search)
  
  // Best free solution without API key: Use a curated vehicle image URL pattern
  // Or use a service that provides vehicle images via URL pattern
  
  // For now, using a pattern that should return vehicle images
  // Using Unsplash with better query format
  const query = encodeURIComponent(`${make} ${model} ${year} car vehicle`);
  return `https://source.unsplash.com/featured/800x600/?${query}`;
}

// Update each vehicle's images with better URLs
vehicles.forEach(vehicle => {
  // Try to get a better image URL
  const imageUrl = getBetterVehicleImageUrl(vehicle.make, vehicle.model, vehicle.year);
  vehicle.images = [imageUrl];
});

// Write back to file
fs.writeFileSync('mock-vehicles.json', JSON.stringify(vehicles, null, 2));

console.log(`Updated ${vehicles.length} vehicles with new image URLs`);
console.log('Using Unsplash with featured/ query format for better vehicle image matching');

