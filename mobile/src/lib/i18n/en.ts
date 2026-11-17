export const en = {
  common: {
    appName: 'Nassayem',
    retry: 'Try again',
    loading: 'Loading…',
    cancel: 'Cancel',
  },
  errors: {
    NETWORK: 'No connection to the server. Check your internet and try again.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    TOO_MANY_ATTEMPTS: 'Too many attempts. Please wait a few minutes and try again.',
    VALIDATION: 'Please check the information you entered.',
    UNAUTHORIZED: 'Your session has ended. Please sign in again.',
    FORBIDDEN: 'You do not have access to this.',
    NOT_FOUND: 'Not found.',
    BAD_RESPONSE: 'Something went wrong. Please try again.',
    SERVER: 'The server had a problem. Please try again.',
  },
  login: {
    title: 'Staff sign in',
    subtitle: 'Use the same email and password as the website admin.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    required: 'Enter your email and password.',
  },
  tabs: {
    home: 'Home',
    tasks: 'Tasks',
    profile: 'Profile',
  },
  home: {
    greeting: 'Hello, {{name}}',
    buildings: 'Your buildings',
    allBuildings: 'All buildings',
    noModules: 'Nothing is available in the app for your role yet. Please keep using the website.',
  },
  tasks: {
    comingSoon: 'Your tasks will appear here.',
  },
  profile: {
    role: 'Role',
    email: 'Email',
    language: 'Language',
    english: 'English',
    arabic: 'العربية',
    signOut: 'Sign out',
    signOutConfirm: 'Sign out of Nassayem?',
    version: 'Version {{version}}',
  },
  update: {
    title: 'Update required',
    body: 'This version of the app is no longer supported. Please install the latest version to continue.',
  },
};

export type Translations = typeof en;
