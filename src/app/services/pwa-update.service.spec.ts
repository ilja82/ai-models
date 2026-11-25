import {DOCUMENT} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {SwUpdate} from '@angular/service-worker';
import {Subject} from 'rxjs';
import {vi, type Mock} from 'vitest';
import {PwaUpdateService} from './pwa-update.service';

const KEY = 'pwa-update.reloaded-hash';

const ready = (hash: string) => ({
  type: 'VERSION_READY',
  currentVersion: {hash: 'old'},
  latestVersion: {hash},
});

describe('PwaUpdateService', () => {
  let versionUpdates: Subject<unknown>;
  let unrecoverable: Subject<unknown>;
  let activateUpdate: Mock;
  let reload: Mock;
  let store: Map<string, string>;
  let win: any;
  let doc: any;

  function create(): PwaUpdateService {
    TestBed.configureTestingModule({
      providers: [
        {provide: SwUpdate, useValue: {isEnabled: true, versionUpdates, unrecoverable, activateUpdate, checkForUpdate: () => Promise.resolve(false)}},
        {provide: DOCUMENT, useValue: doc},
      ],
    });
    return TestBed.inject(PwaUpdateService);
  }

  const flush = () => new Promise<void>(resolve => setTimeout(resolve));

  function deferred() {
    let resolve!: (v: boolean) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<boolean>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {promise, resolve, reject};
  }

  beforeEach(() => {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    activateUpdate = vi.fn().mockResolvedValue(true);
    reload = vi.fn();
    store = new Map();
    win = {
      location: {reload},
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    doc = {
      defaultView: win,
      visibilityState: 'visible',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
  });

  it('reloads only after activation finishes and keeps the hint hidden', async () => {
    const gate = deferred();
    activateUpdate.mockReturnValue(gate.promise);
    const svc = create();
    versionUpdates.next(ready('h1'));
    await flush();
    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(svc.showHint()).toBe(false);
    gate.resolve(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(KEY)).toBe('h1');
    expect(svc.showHint()).toBe(false);
  });

  it('ignores other version events', async () => {
    const svc = create();
    versionUpdates.next({type: 'VERSION_DETECTED', version: {hash: 'h1'}});
    await flush();
    expect(activateUpdate).not.toHaveBeenCalled();
    expect(svc.showHint()).toBe(false);
  });

  it('keeps the stored hash and shows the hint when activateUpdate rejects', async () => {
    activateUpdate.mockRejectedValueOnce(new Error('fail'));
    const svc = create();
    versionUpdates.next(ready('hA'));
    await flush();
    expect(reload).not.toHaveBeenCalled();
    expect(store.get(KEY)).toBe('hA');
    expect(svc.showHint()).toBe(true);
    versionUpdates.next(ready('hA'));
    await flush();
    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(svc.showHint()).toBe(true);
  });

  it('shows the hint when reload throws', async () => {
    reload.mockImplementation(() => { throw new Error('blocked'); });
    const svc = create();
    versionUpdates.next(ready('h1'));
    await flush();
    expect(svc.showHint()).toBe(true);
  });

  it('shows the hint when no window is available', async () => {
    doc.defaultView = null;
    const svc = create();
    versionUpdates.next(ready('h1'));
    await flush();
    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(svc.showHint()).toBe(true);
  });

  it('shows the hint for a stored hash in a fresh service, and saves a different hash before reload', async () => {
    store.set(KEY, 'h1');
    const svc = create();
    versionUpdates.next(ready('h1'));
    await flush();
    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(svc.showHint()).toBe(true);

    let seenInActivate: {hash: string | undefined; hint: boolean} | null = null;
    const gate = deferred();
    activateUpdate.mockImplementation(() => {
      seenInActivate = {hash: store.get(KEY), hint: svc.showHint()};
      return gate.promise;
    });
    versionUpdates.next(ready('h2'));
    await flush();
    expect(seenInActivate).toEqual({hash: 'h2', hint: false});
    expect(svc.showHint()).toBe(false);
    gate.resolve(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('runs one attempt for two ready events with the same hash', async () => {
    const gate = deferred();
    activateUpdate.mockReturnValue(gate.promise);
    create();
    versionUpdates.next(ready('h1'));
    versionUpdates.next(ready('h1'));
    await flush();
    gate.resolve(true);
    await flush();
    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the hint when sessionStorage is unreadable', async () => {
    Object.defineProperty(win, 'sessionStorage', {get: () => { throw new Error('denied'); }});
    const svc = create();
    versionUpdates.next(ready('h1'));
    await flush();
    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(svc.showHint()).toBe(true);
  });

  it('does not activate when sessionStorage is unwritable', async () => {
    win.sessionStorage.setItem = () => { throw new Error('quota'); };
    const svc = create();
    versionUpdates.next(ready('h1'));
    await flush();
    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(svc.showHint()).toBe(true);
  });

  it('shows the hint on unrecoverable without reloading, and applyUpdate still works', async () => {
    const svc = create();
    unrecoverable.next({reason: 'x'});
    await flush();
    expect(svc.showHint()).toBe(true);
    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    await svc.applyUpdate();
    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the hint for B while A activates, reloads once and activates once', async () => {
    const a = deferred();
    activateUpdate.mockReturnValue(a.promise);
    const svc = create();
    versionUpdates.next(ready('hA'));
    await flush();
    const setItem = vi.spyOn(win.sessionStorage, 'setItem');
    const removeItem = vi.spyOn(win.sessionStorage, 'removeItem');
    versionUpdates.next(ready('hB'));
    await flush();
    expect(svc.showHint()).toBe(true);
    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(store.get(KEY)).toBe('hA');
    a.resolve(true);
    await flush();
    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(KEY)).toBe('hA');
  });

  it('starts the manual path at once on click and reloads exactly once', async () => {
    const a = deferred();
    activateUpdate.mockReturnValueOnce(a.promise).mockResolvedValue(true);
    const svc = create();
    versionUpdates.next(ready('hA'));
    await flush();
    unrecoverable.next({reason: 'x'});
    await svc.applyUpdate();
    expect(activateUpdate).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
    a.resolve(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload twice when the pending automatic attempt rejects after a click', async () => {
    const a = deferred();
    activateUpdate.mockReturnValueOnce(a.promise).mockResolvedValue(true);
    const svc = create();
    versionUpdates.next(ready('hA'));
    await flush();
    await svc.applyUpdate();
    a.reject(new Error('fail'));
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('gives a later attempt its own reload after a manual reload threw', async () => {
    const a = deferred();
    activateUpdate.mockReturnValueOnce(a.promise).mockResolvedValue(true);
    const svc = create();
    versionUpdates.next(ready('hA'));
    await flush();
    reload.mockImplementationOnce(() => { throw new Error('blocked'); });
    await expect(svc.applyUpdate()).rejects.toThrow('blocked');
    a.resolve(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    versionUpdates.next(ready('hB'));
    await flush();
    expect(activateUpdate).toHaveBeenCalledTimes(3);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(svc.showHint()).toBe(false);
  });

  it('shows the hint for a later attempt whose activation fails after a click without pending attempt', async () => {
    const svc = create();
    await svc.applyUpdate();
    activateUpdate.mockRejectedValueOnce(new Error('fail'));
    versionUpdates.next(ready('hB'));
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(svc.showHint()).toBe(true);
  });
});
