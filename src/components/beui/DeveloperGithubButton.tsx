import { ButtonLink } from '../motion/button';

export default function DeveloperGithubButton() {
  return (
    <ButtonLink
      href="https://github.com/vietnam-awesome/emoji"
      rel="noreferrer"
      variant="secondary"
      className="beui-github-button"
    >
      GitHub
      <span aria-hidden="true">↗</span>
    </ButtonLink>
  );
}
