/**
 * The design kit's Memoji avatars and the Moddy icon, as URLs. Dev only: this
 * module is reached through the mock, which production builds never contain.
 */

import alex from '../../../design-kit/assets/avatars/alex.webp?url';
import alex2 from '../../../design-kit/assets/avatars/alex2.webp?url';
import leo from '../../../design-kit/assets/avatars/leo.webp?url';
import mia from '../../../design-kit/assets/avatars/mia.webp?url';
import moddy from '../../../design-kit/assets/avatars/moddy.webp?url';
import sam from '../../../design-kit/assets/avatars/sam.webp?url';
import troublemaker from '../../../design-kit/assets/avatars/troublemaker.webp?url';

export const avatars = {alex, alex2, leo, mia, moddy, sam, troublemaker} as const;

/**
 * An https address for a service's image (the API only takes https). Nothing real answers there: the browser mock
 * serves these from the kit's avatars (`mockImageHandler` in ../browser.tsx).
 */
export const MOCK_IMAGE_HOST = 'https://images.lineup-mock.example';
export const mockImageUrl = (name: keyof typeof avatars): string => `${MOCK_IMAGE_HOST}/${name}.webp`;
