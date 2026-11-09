// Settings for the Privacy Policy and Terms pages (app/privacy, app/terms).
//
// TODO(Tyler): confirm every value in this file before launch, and have a
// lawyer review both pages. While LEGAL_DRAFT is true, both pages show a
// "draft" notice at the top.

/** Where people should write about privacy, billing, or legal questions. */
export const CONTACT_EMAIL = 'support@landethic.io';

/** Name used for "we/us" on the legal pages. TODO(Tyler): confirm once the LLC is formed. */
export const BUSINESS_NAME = 'LandEthic LLC';

/** Shown as the "last updated" date on both pages. */
export const LEGAL_LAST_UPDATED = 'October 13, 2026';

/** State whose laws govern the Terms. Leave null until decided. */
export const GOVERNING_LAW_STATE: string | null = null;

/** Set to false once a lawyer has reviewed the pages. */
export const LEGAL_DRAFT = true;
