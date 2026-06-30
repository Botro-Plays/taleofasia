import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';

export default async function VoteReturnPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect('/shop');
  }
  redirect('/');
}
