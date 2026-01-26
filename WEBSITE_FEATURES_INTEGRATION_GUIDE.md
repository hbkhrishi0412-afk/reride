# Website-Only Features Integration Guide

This guide explains how to integrate the new website-only features into your components.

## 1. Bulk Selection Integration

### In Dashboard Listings View

Add bulk selection state and handlers:

```typescript
import BulkActionsBar from './BulkActionsBar';
import useIsMobileApp from '../hooks/useIsMobileApp';
import { vehiclesToCSV, downloadCSV } from '../utils/exportUtils';

// In your component:
const { isMobileApp } = useIsMobileApp();
const [selectedVehicles, setSelectedVehicles] = useState<Set<number>>(new Set());

// Add checkbox column to table header
<th className="px-6 py-3">
  <input
    type="checkbox"
    checked={selectedVehicles.size === activeListings.length && activeListings.length > 0}
    onChange={(e) => {
      if (e.target.checked) {
        setSelectedVehicles(new Set(activeListings.map(v => v.id)));
      } else {
        setSelectedVehicles(new Set());
      }
    }}
    disabled={isMobileApp}
  />
</th>

// Add checkbox to each row
<td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
  <input
    type="checkbox"
    checked={selectedVehicles.has(v.id)}
    onChange={(e) => {
      const newSelected = new Set(selectedVehicles);
      if (e.target.checked) {
        newSelected.add(v.id);
      } else {
        newSelected.delete(v.id);
      }
      setSelectedVehicles(newSelected);
    }}
    disabled={isMobileApp}
  />
</td>

// Add BulkActionsBar at the bottom
{!isMobileApp && (
  <BulkActionsBar
    selectedCount={selectedVehicles.size}
    totalCount={activeListings.length}
    onSelectAll={() => setSelectedVehicles(new Set(activeListings.map(v => v.id)))}
    onDeselectAll={() => setSelectedVehicles(new Set())}
    onBulkDelete={() => {
      selectedVehicles.forEach(id => onDeleteVehicle(id));
      setSelectedVehicles(new Set());
    }}
    onBulkMarkAsSold={() => {
      selectedVehicles.forEach(id => onMarkAsSold(id));
      setSelectedVehicles(new Set());
    }}
    onBulkFeature={() => {
      selectedVehicles.forEach(id => onFeatureListing(id));
      setSelectedVehicles(new Set());
    }}
    onBulkExport={() => {
      const vehiclesToExport = activeListings.filter(v => selectedVehicles.has(v.id));
      const csv = vehiclesToCSV(vehiclesToExport);
      downloadCSV(csv, `vehicles-export-${new Date().toISOString().split('T')[0]}.csv`);
    }}
  />
)}
```

## 2. Advanced Filters Integration

### In VehicleList Component

```typescript
import AdvancedFilters from './AdvancedFilters';
import useIsMobileApp from '../hooks/useIsMobileApp';

// In your component:
const { isMobileApp } = useIsMobileApp();
const [filteredVehicles, setFilteredVehicles] = useState(vehicles);

// Add before vehicle list rendering
{!isMobileApp && (
  <AdvancedFilters
    vehicles={vehicles}
    onFilterChange={setFilteredVehicles}
    vehicleData={vehicleData}
  />
)}

// Use filteredVehicles instead of vehicles
{filteredVehicles.map(vehicle => (
  // ... render vehicle
))}
```

## 3. Export/Import Integration

### Export Functionality

```typescript
import { vehiclesToCSV, downloadCSV } from '../utils/exportUtils';

const handleExport = () => {
  const csv = vehiclesToCSV(vehicles);
  downloadCSV(csv, `vehicles-export-${Date.now()}.csv`);
};
```

### Import Functionality

```typescript
import { parseCSVToVehicles, readFileAsText } from '../utils/exportUtils';

const handleImport = async (file: File) => {
  try {
    const content = await readFileAsText(file);
    const vehicles = parseCSVToVehicles(content);
    // Process imported vehicles
    onAddMultipleVehicles(vehicles);
  } catch (error) {
    console.error('Import failed:', error);
    alert('Failed to import vehicles. Please check the CSV format.');
  }
};
```

## 4. Enhanced Analytics

The Dashboard already includes enhanced analytics. To add more charts:

```typescript
import { Line } from 'react-chartjs-2';

// Add time-series chart
const timeSeriesData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [{
    label: 'Views Over Time',
    data: [/* your data */],
    borderColor: 'rgba(255, 107, 53, 1)',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  }]
};

<Line data={timeSeriesData} options={chartOptions} />
```

## 5. Mobile App Detection

All website-only features should check for mobile app:

```typescript
import useIsMobileApp from '../hooks/useIsMobileApp';

const { isMobileApp } = useIsMobileApp();

// Don't render website-only features on mobile
if (isMobileApp) return null;
// or
{!isMobileApp && <WebsiteOnlyComponent />}
```

## Best Practices

1. **Always check `isMobileApp`** before rendering website-only features
2. **Lazy load** heavy components (use React.lazy)
3. **Provide fallbacks** for mobile users (simpler UI)
4. **Test on both** website and mobile app
5. **Document** which features are website-only

## Testing Checklist

- [ ] Bulk selection works on website
- [ ] Bulk selection disabled on mobile app
- [ ] Advanced filters work on website
- [ ] Advanced filters hidden on mobile app
- [ ] Export generates valid CSV
- [ ] Import parses CSV correctly
- [ ] Analytics charts render properly
- [ ] Keyboard shortcuts work on website
- [ ] Keyboard shortcuts disabled on mobile app


