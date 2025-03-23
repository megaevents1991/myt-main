import { revalidatePath } from 'next/cache';
 
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const path = searchParams.get('path');

  if (secret !== process.env.REVALIDATION_SECRET) {
    return new Response('Invalid token', { status: 401 });
  }

  if (path === undefined) {
    return new Response('Path is required', { status: 401 })
  }

  revalidatePath(path as string);

  return new Response('Revalidation successful', { status: 200 });
}