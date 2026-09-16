import { Search } from 'lucide-react';
import { Button } from '../motion/button';
import { Input } from '../motion/input';

interface HomeSearchFormProps {
  action: string;
}

export default function HomeSearchForm({ action }: HomeSearchFormProps) {
  return (
    <form className="hero-search beui-hero-search" action={action} method="get" role="search">
      <Input
        id="home-emoji-search"
        type="search"
        name="q"
        placeholder="Search name, :shortcode:, tag or category"
        aria-label="Search emoji"
        aria-controls="home-search-results"
        aria-expanded="false"
        autoComplete="off"
        leftIcon={<Search aria-hidden="true" />}
        className="min-w-0 flex-1"
        classNames={{
          field: 'h-11 border-border bg-background',
          input: 'text-sm'
        }}
      />
      <Button type="submit" size="md" ripple className="beui-search-button shrink-0">
        Search
      </Button>
    </form>
  );
}
