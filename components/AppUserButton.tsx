'use client';

import { UserButton } from '@clerk/nextjs';

// Shared so the "Manage plan" entry shows up in the Clerk profile dropdown
// everywhere <UserButton> is rendered, not just on the dashboard.
export default function AppUserButton() {
  return (
    <UserButton afterSignOutUrl="/">
      <UserButton.MenuItems>
        <UserButton.Link
          label="Manage plan"
          href="/upgrade"
          labelIcon={<span aria-hidden="true">💳</span>}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
