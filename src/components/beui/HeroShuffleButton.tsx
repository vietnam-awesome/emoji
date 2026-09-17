import { Shuffle } from 'lucide-react';
import { Button } from '../motion/button';

export default function HeroShuffleButton() {
  return (
    <Button
      id="hero-shuffle"
      type="button"
      variant="secondary"
      size="sm"
      ripple
      className="hero-shuffle"
      aria-controls="hero-random-grid"
      aria-label="Show another set of emoji"
      data-beui-tooltip="Shuffle emoji"
    >
      <Shuffle className="size-3.5" aria-hidden="true" />
      <span>Shuffle</span>
    </Button>
  );
}
