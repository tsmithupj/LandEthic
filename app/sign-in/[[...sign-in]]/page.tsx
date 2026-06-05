import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <a href="/" className="text-base font-semibold">
          <span style={{ color: '#3B6D11' }}>Land</span>Ethic.io
        </a>
        <p className="text-sm text-gray-400">
          No account?{' '}
          <a href="/sign-up" className="font-medium" style={{ color: '#3B6D11' }}>
            Sign up free
          </a>
        </p>
      </div>

      {/* Centered sign-in card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500">
            Sign in to access your land management plans.
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full max-w-md',
              card: 'shadow-none border border-gray-100 rounded-2xl p-8',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              socialButtonsBlockButton:
                'border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium',
              formButtonPrimary:
                'rounded-xl font-semibold py-3',
              formFieldInput:
                'rounded-xl border-gray-200 focus:border-[#639922] focus:ring-[#639922]',
              footerActionLink: 'text-[#3B6D11] font-medium',
            },
          }}
        />
      </div>
    </div>
  );
}
