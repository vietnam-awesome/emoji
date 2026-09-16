import { Button } from '../motion/button';

export default function HeroShuffleButton() {
  return (
    <Button
      id="hero-shuffle"
      type="button"
      variant="secondary"
      size="sm"
      className="hero-shuffle beui-shuffle-button"
      aria-controls="hero-random-grid"
      aria-label="Show another set of emoji"
      title="Shuffle emoji"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Shuffle</span>
    </Button>
  );
}
