import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <a href="/" className="text-base font-semibold">
          <span style={{ color: '#3B6D11' }}>Land</span>Ethic.io
        </a>
        <p className="text-sm text-gray-400">
          Have an account?{' '}
          <a href="/sign-in" className="font-medium" style={{ color: '#3B6D11' }}>
            Sign in
          </a>
        </p>
      </div>

      {/* Centered sign-up card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Start stewarding your land
          </h1>
          <p className="text-sm text-gray-500">
            Free forever. No credit card required.
          </p>
        </div>
        <SignUp
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
