import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  if (!request.cookies.has('visitor.id')) {
    const visitorId = Math.random().toString(16).slice(2);
    request.cookies.set('visitor.id', visitorId);
    const response = NextResponse.next();
    response.cookies.set('visitor.id', visitorId);
    return response;
  }
  return NextResponse.next();
}
