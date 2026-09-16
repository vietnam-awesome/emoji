import { Search } from 'lucide-react';
import { Button } from '../motion/button';
import { Input } from '../motion/input';

interface HomeSearchFormProps {
  action: string;
}

export default function HomeSearchForm({ action }: HomeSearchFormProps) {
  return (
    <form
      className="hero-search beui-hero-search !flex !items-center !gap-2 !border-0 !bg-transparent !p-0 !shadow-none"
      action={action}
      method="get"
      role="search"
    >
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
          field: '!h-11 !border-border !bg-background !shadow-sm',
          input: 'text-sm'
        }}
      />
      <Button
        type="submit"
        size="md"
        variant="secondary"
        ripple
        className="beui-search-button shrink-0 !border !border-border !bg-background !text-foreground !shadow-sm hover:!bg-card dark:!border-foreground dark:!bg-foreground dark:!text-background dark:hover:!bg-foreground/90"
      >
        Search
      </Button>
    </form>
  );
}
