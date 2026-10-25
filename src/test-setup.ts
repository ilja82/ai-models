// jsdom (the unit-test environment) does not implement window.matchMedia.
// ThemeState reads it at construction, so provide a minimal stub for tests.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// AppState applies a URL hash over the stored values, and components write one; reset it so no test sees another's.
beforeEach(() => history.replaceState(null, '', window.location.pathname));
