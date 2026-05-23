# Masjid Times

A modern, responsive Next.js application designed to display prayer times (Adhan and Jamaat) for Masajid. This project is ideal for use on large TV screens or monitors within a masjid, as well as a public-facing website for community members.

## Features

* **Live Prayer Times**: Automatically calculates Adhan times based on your masjid's coordinates using the `adhan` library.
* **Manual Jamaat Updates**: A secure admin panel allows masjid staff to update Jamaat (congregation) times manually as they change throughout the year.
* **Next Prayer Countdown**: Displays a live clock and a real-time countdown to the next upcoming prayer.
* **Jumu'ah Support**: Support for multiple Jumu'ah khutbah and salah slots.
* **Adaptive Display**: The interface is designed to work in both portrait and landscape modes, making it versatile for different screen types.
* **Dual Storage**: Automatically uses the local filesystem for development and supports Vercel KV for cloud persistence in production.

## Tech Stack

* **Framework**: Next.js 16 (App Router)
* **Styling**: Tailwind CSS 4
* **Prayer Calculations**: Adhan.js
* **Database**: Vercel KV / Local JSON
* **Language**: TypeScript

## Getting Started

### 1. Configuration

To adapt this for your masjid, edit the configuration file at `src/config/masjid.ts`. You must provide your masjid's name, timezone, coordinates, and preferred calculation method:

```typescript
// src/config/masjid.ts
export const masjid = {
  name: "Your Masjid Name",
  timezone: "America/Chicago", // Your local timezone
  coordinates: { lat: 31.3271, lon: -89.2903 }, // Your latitude and longitude
  calc: {
    method: "NORTH_AMERICA", // Calculation method
    fajrAngle: 18,  
    ishaAngle: 18,
    madhab: "HANAFI", // HANAFI or SHAFI
  },
};

```

### 2. Environment Variables

Create a `.env.local` file in the root directory and add a passcode for the admin panel. If you are deploying to Vercel, you will also need the KV credentials.

```env
ADMIN_PASSCODE=your_secure_passcode_here
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

```

### 3. Installation & Development

Run the following commands to get started locally:

```bash
npm install
npm run dev

```

Open [http://localhost:3000/display](https://www.google.com/search?q=http://localhost:3000/display) to see the live board or [http://localhost:3000/admin](https://www.google.com/search?q=http://localhost:3000/admin) to log in and update times.

## Admin Panel

The admin panel is accessible at `/admin`. It requires the `ADMIN_PASSCODE` you set in your environment variables to log in. Once logged in, you can:

* Update Jamaat times for the five daily prayers.
* Add or remove multiple Jumu'ah prayer slots.
* Changes are synchronized across both local storage and the cloud (if configured).

## Google Calendar / iCal Export

You can export the prayer schedule as an iCal (.ics) file compatible with Google Calendar and other calendar apps. Look for the "Export iCal for Google Calendar" button on the homepage, or download directly from [`/api/ical`](http://localhost:3000/api/ical).

## Deployment

This project is optimized for the [Vercel Platform](https://vercel.com/new). When deploying:

1. Connect your GitHub repository to Vercel.
2. Add your `ADMIN_PASSCODE` to the Environment Variables in the Vercel dashboard.
3. For persistent storage, add the **Vercel KV** integration to your project.

## Project Structure

* `src/app/display/page.tsx`: The public prayer board interface.
* `src/app/admin/page.tsx`: The password-protected management interface.
* `src/lib/db.ts`: Logic for reading and writing jamaat times to storage.
* `src/lib/time.ts`: Utilities for time formatting and timezone handling.
* `data/jamaat.json`: Local storage file for prayer times (created automatically).
