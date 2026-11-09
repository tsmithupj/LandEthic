import { SignUp } from '@clerk/nextjs';
import AuthShell, { clerkAppearance } from '@/components/AuthShell';

export default function SignUpPage() {
  return (
    <AuthShell
      title="Start stewarding your land"
      subtitle="Free forever. No credit card required."
      switchPrompt="Have an account?"
      switchHref="/sign-in"
      switchLabel="Sign in"
    >
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  );
}
