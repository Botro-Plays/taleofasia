import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/rankings?type=battle-royale');
}
