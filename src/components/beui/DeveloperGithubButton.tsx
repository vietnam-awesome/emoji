import { ExternalLink } from 'lucide-react';
import { ButtonLink } from '../motion/button';

export default function DeveloperGithubButton() {
  return (
    <ButtonLink
      href="https://github.com/vietnam-awesome/emoji"
      rel="noreferrer"
      variant="secondary"
      className="bg-background text-foreground hover:bg-card"
    >
      GitHub
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </ButtonLink>
  );
}
