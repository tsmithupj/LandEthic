'use client';

import { UserButton } from '@clerk/nextjs';
import { Icon } from '@/components/brand';

// Shared so the "Manage plan" entry shows up in the Clerk profile dropdown
// everywhere <UserButton> is rendered, not just on the dashboard.
// (Where to go after sign-out is set once on <ClerkProvider> in app/layout.tsx.)
export default function AppUserButton() {
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: 'h-8 w-8 ring-2 ring-paper-line',
          userButtonPopoverCard: 'border border-paper-line',
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Manage plan"
          href="/upgrade"
          labelIcon={<Icon.Card size={16} />}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
