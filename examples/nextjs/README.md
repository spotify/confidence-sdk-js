# Confidence SDK Next.js Example

This example demonstrates how to use the Confidence SDK in a Next.js application, showcasing both server-side and client-side feature flag resolution.

## Features

- Server-side rendered components using Confidence flags
- Client-side interactive components with real-time flag updates
- Tailwind CSS for styling
- TypeScript support
- Modern Next.js App Router architecture

## Getting Started

1. First, build the Confidence SDK packages:
   ```bash
   yarn build
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Create a `.env.local` file with your Confidence client secret:
   ```
   CONFIDENCE_CLIENT_SECRET=your_secret_here
   ```

4. Run the development server:
   ```bash
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the example.

## Example Structure

This example demonstrates:

1. **Server Components**: The navbar and footer are server components that resolve feature flags during server-side rendering
2. **Client Components**: The main content area shows how to use Confidence flags in interactive client components
3. **Context Management**: How to update context and see flag values change in real-time
4. **Styling**: Modern UI using Tailwind CSS

## Key Files

- `src/app/layout.tsx`: Root layout with Confidence provider setup
- `src/app/page.tsx`: Main page component
- `src/components/Navbar.tsx`: Server-side rendered navigation
- `src/components/Footer.tsx`: Server-side rendered footer
- `src/components/Content.tsx`: Client-side interactive content
- `src/lib/confidence.ts`: Confidence client configuration
