# Service Management Setup Guide

This guide explains how to set up and use the Service Management feature in the admin panel.

## Overview

The Service Management feature allows admins to control pricing for all car services through the admin panel. All pricing is stored in Supabase and automatically synced across the application.

## Services Included

The following 6 services are managed:

1. **Periodic Service** - OEM recommended service schedules
2. **AC Service** - Complete AC servicing
3. **Car Scan** - Car diagnostics and health scanning
4. **Wheel Care** - Wheel alignment and balancing
5. **Interior Clean** - Interior deep cleaning
6. **Engine Care** - Engine maintenance and repairs

## Setup Steps

### 1. Create the Services Table in Supabase

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Run the SQL script: `scripts/create-services-table.sql`
4. This will create the `services` table and insert default services with initial pricing

### 2. Verify the Table

After running the SQL script, verify that:
- The `services` table exists
- 6 services are inserted with default pricing
- The table has proper indexes and RLS policies

### 3. Access Service Management

1. Log in to the admin panel
2. Navigate to **Service Management** in the sidebar
3. You should see all 6 services listed with their current pricing

## Using Service Management

### Viewing Services

- All services are displayed in a table showing:
  - Service name and description
  - Base price
  - Price range
  - Active/Inactive status

### Editing Service Pricing

1. Click the **Edit** button next to any service
2. Update the following fields:
   - **Display Name**: The name shown to users
   - **Description**: Service description
   - **Base Price**: The base price in ₹
   - **Min Price**: Minimum price in ₹
   - **Max Price**: Maximum price in ₹
   - **Price Range**: Display text (e.g., "₹2,499 - ₹4,999")
   - **Active**: Toggle to enable/disable the service
3. Click **Save Changes**

### Toggling Service Status

- Click the **Active/Inactive** button in the Status column to quickly enable or disable a service
- Inactive services won't be shown to users

## How It Works

### Data Flow

1. **Admin Panel** → Updates pricing in Supabase via `/api/services`
2. **Supabase** → Stores pricing in the `services` table
3. **Frontend** → Fetches pricing from `/api/services` when displaying services
4. **ServiceDetail Component** → Uses fetched pricing to display current rates

### Caching

- Pricing is cached for 5 minutes to reduce API calls
- Cache is automatically cleared when admin updates pricing
- Fallback pricing is used if Supabase is unavailable

## API Endpoints

### GET /api/services
- Returns all active services
- Public read access (no authentication required for reading)

### PATCH /api/services
- Updates a service
- Requires admin authentication
- Body: `{ id: string, ...updates }`

### POST /api/services
- Creates a new service
- Requires admin authentication

### DELETE /api/services?id={id}
- Soft deletes a service (sets active to false)
- Requires admin authentication

## Troubleshooting

### Services Not Showing

1. Verify the SQL script ran successfully
2. Check Supabase logs for errors
3. Verify RLS policies allow public read access
4. Check browser console for API errors

### Pricing Not Updating

1. Clear browser cache
2. Check if service is marked as active
3. Verify API endpoint is accessible
4. Check Supabase connection

### Admin Can't Edit

1. Verify user has admin role
2. Check authentication token is valid
3. Verify API endpoint permissions

## Default Pricing

If Supabase is unavailable, the app uses these fallback prices:

- Car Scan: ₹999 - ₹2,499
- AC Service: ₹1,999 - ₹3,499
- Periodic Service: ₹2,499 - ₹4,999
- Wheel Care: ₹1,499 - ₹2,999
- Interior Clean: ₹3,999 - ₹5,999
- Engine Care: ₹2,499 - ₹4,999

## Notes

- All prices are in Indian Rupees (₹)
- Prices are stored as numbers (not strings)
- Price ranges are displayed as formatted strings
- Services can be temporarily disabled without deleting them


