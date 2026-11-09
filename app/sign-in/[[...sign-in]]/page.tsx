import { SignIn } from '@clerk/nextjs';
import AuthShell, { clerkAppearance } from '@/components/AuthShell';

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your land management plans."
      switchPrompt="No account?"
      switchHref="/sign-up"
      switchLabel="Sign up free"
    >
      <SignIn appearance={clerkAppearance} />
    </AuthShell>
  );
}
