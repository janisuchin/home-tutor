/**
 * Web route table for the router shim. Every screen is its own lazy chunk, so the first screen
 * downloads only what it needs. A unit test checks this list matches the files in src/app.
 */
import type { ComponentType } from 'react';

export interface WebRoute {
  path: string;
  /** Layout that wraps the page (besides the root layout). */
  layout?: 'learn';
  load: () => Promise<{ default: ComponentType<any> }>;
}

export const ROUTES: WebRoute[] = [
  { path: '/about', load: () => import('../app/about') },
  { path: '/account', load: () => import('../app/account') },
  { path: '/classroom', load: () => import('../app/classroom/index') },
  { path: '/classroom/present', load: () => import('../app/classroom/present') },
  { path: '/classroom/report', load: () => import('../app/classroom/report') },
  { path: '/credits', load: () => import('../app/credits') },
  { path: '/emergency', load: () => import('../app/emergency') },
  { path: '/', load: () => import('../app/index') },
  { path: '/learn/[childId]/area/[area]', layout: 'learn', load: () => import('../app/learn/[childId]/area/[area]') },
  { path: '/learn/[childId]/books', layout: 'learn', load: () => import('../app/learn/[childId]/books') },
  { path: '/learn/[childId]/careers', layout: 'learn', load: () => import('../app/learn/[childId]/careers') },
  { path: '/learn/[childId]/explore', layout: 'learn', load: () => import('../app/learn/[childId]/explore') },
  { path: '/learn/[childId]', layout: 'learn', load: () => import('../app/learn/[childId]/index') },
  { path: '/learn/[childId]/item/[itemId]', layout: 'learn', load: () => import('../app/learn/[childId]/item/[itemId]') },
  { path: '/learn/[childId]/passport', layout: 'learn', load: () => import('../app/learn/[childId]/passport') },
  { path: '/learn/[childId]/pathway/[id]', layout: 'learn', load: () => import('../app/learn/[childId]/pathway/[id]') },
  { path: '/learn/[childId]/skills', layout: 'learn', load: () => import('../app/learn/[childId]/skills') },
  { path: '/parent/books', load: () => import('../app/parent/books') },
  { path: '/parent/child-edit', load: () => import('../app/parent/child-edit') },
  { path: '/parent/child/[id]', load: () => import('../app/parent/child/[id]') },
  { path: '/parent/confirm', load: () => import('../app/parent/confirm') },
  { path: '/parent', load: () => import('../app/parent/index') },
  { path: '/parent/keys/[childId]', load: () => import('../app/parent/keys/[childId]') },
  { path: '/parent/settings', load: () => import('../app/parent/settings') },
  { path: '/parent/tutors', load: () => import('../app/parent/tutors') },
  { path: '/passport/[code]', load: () => import('../app/passport/[code]') },
  { path: '/passport/open', load: () => import('../app/passport/open') },
  { path: '/print/[childId]', load: () => import('../app/print/[childId]') },
  { path: '/privacy', load: () => import('../app/privacy') },
  { path: '/review', load: () => import('../app/review') },
  { path: '/setup', load: () => import('../app/setup') },
  { path: '/tutor', load: () => import('../app/tutor') },
  { path: '/tutoring', load: () => import('../app/tutoring') },
];

export const LAYOUTS = {
  learn: () => import('../app/learn/[childId]/_layout'),
};
