# Confidence SDK Next.js Example

This example demonstrates how to use the Confidence SDK in a Next.js application, showcasing both client-side and server-side functionality.

## Features

- Next.js 15 with App Router
- TypeScript support
- Tailwind CSS for styling
- Client-side feature flag evaluation using `useConfidence` hook
- Server-side feature flag evaluation using `getFlag()`
- Real-time feature flag updates
- Modern, responsive UI with dynamic styling based on feature flags
- Visitor ID context switching using cookies for server-client state management
- Multiple routes demonstrating feature flag usage

## Getting Started

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Set up your environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` with your Confidence SDK configuration.

3. Run the development server:
   ```bash
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Example Components

### Server-Side Components

The example includes server-side rendered components that demonstrate server-side feature flag evaluation:

- `Navbar`: A modern navigation bar that uses `getFlag()` to determine styling and includes:
  - Navigation links to different pages
  - VisitorSelector dropdown component for switching between visitor IDs:
    - 'new_button_style_visitor'
    - 'default_button_style_visitor'
- `Footer`: A footer component that uses `getFlag()` for dynamic styling
- Both components demonstrate server-side feature flag evaluation for the 'button-style' flag

### Client-Side Components

Client-side components demonstrate the use of Confidence SDK hooks:

- `MainContent`: Uses `useConfidence` hook for real-time feature flag evaluation
- Dynamic styling based on the 'button-style' flag's inverted boolean property

### Visitor ID Management

The example uses cookies to manage the Visitor ID state between server and client components:

- The Visitor ID is stored in a cookie named 'visitor_id'
- Server components read the Visitor ID from the cookie using Next.js's built-in cookie handling
- Client components access the Visitor ID through the Confidence context
- The VisitorSelector component updates the cookie when switching between visitor IDs
- This approach ensures consistent feature flag evaluation across server and client components

### Routes

The example includes multiple routes to demonstrate feature flag usage across different pages:

- `/`: Home page with main content
- `/page1`: Additional page demonstrating feature flag usage in a different context

## Feature Flag Implementation

The example uses a 'button-style' flag with an inverted boolean property to control the application's visual appearance:

- When inverted: Changes background/foreground colors in components
- When not inverted: Uses default color scheme

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page
│   └── page1/            # Additional page
│       └── page.tsx
├── components/            # React components
│   ├── client/           # Client-side components
│   │   └── MainContent.tsx
│   └── server/           # Server-side components
│       ├── Navbar.tsx    # Includes VisitorSelector
│       └── Footer.tsx
├── lib/                   # Utility functions and configurations
│   ├── confidence/       # Confidence SDK setup
│   │   ├── client.ts    # Client-side SDK configuration
│   │   └── server.ts    # Server-side SDK configuration
│   └── types/           # TypeScript type definitions
└── styles/              # Global styles and Tailwind configuration
```

## Environment Variables

Create a `.env.local` file with the following variable:

```env
CLIENT_TOKEN=your_client_token
```

Note: This example uses only the client token, which is used for both server and client components through the server-side configuration.

## Dependencies

This example uses the latest version of the Confidence React SDK from the source repository, not the published version. The example is compatible with:

- React 18 or 19
- Node.js >= 18.17.0
- Next.js 15+

## Learn More

- [Confidence SDK Documentation](https://docs.confidence.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
