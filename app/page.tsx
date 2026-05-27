import Sandbox from '@/components/Sandbox';
import { PERSONAS } from '@/lib/personas';

export default function Page() {
  return <Sandbox personas={PERSONAS} />;
}
