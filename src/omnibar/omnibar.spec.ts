//#region imports

import {
  BBOmnibar
} from './omnibar';

import {
  BBOmnibarConfig
} from './omnibar-config';

import {
  BBOmnibarNavigationItem
} from './omnibar-navigation-item';

import {
  BBOmnibarSearchArgs
} from './omnibar-search-args';

import {
  BBOmnibarSearchResults
} from './omnibar-search-results';

import {
  BBOmnibarUserActivity
} from './omnibar-user-activity';

import {
  BBOmnibarTheme
} from './theming';

import {
  BBAuthInterop
} from '../shared/interop';

import {
  BBAuthNavigator
} from '../shared/navigator';

import {
  BBAuth
} from '../auth';

import {
  BBOmnibarUpdateArgs
} from './omnibar-update-args';

import {
  BBOmnibarUserActivityPrompt
} from './omnibar-user-activity-prompt';

import {
  BBOmnibarUserActivityPromptShowArgs
} from './omnibar-user-activity-prompt-show-args';

//#endregion

describe('Omnibar', () => {
  const BASE_URL = 'about:blank';

  function loadOmnibar(config?: BBOmnibarConfig) {
    config = config || {};
    config.url = BASE_URL;

    BBOmnibar.load(config);
  }

  function getIframeEl(): HTMLIFrameElement {
    return document.querySelector('.sky-omnibar-iframe') as HTMLIFrameElement;
  }

  function getPlaceholderEl(): HTMLDivElement {
    return document.querySelector('.sky-omnibar-placeholder') as HTMLDivElement;
  }

  function fireMessageEvent(data: any, includeSource = true) {
    if (includeSource) {
      data.source = 'skyux-spa-omnibar';
    }

    window.dispatchEvent(
      new MessageEvent('message', {
        data
      })
    );
  }

  function validateExpanded(expanded: boolean) {
    expect(getIframeEl().classList.contains('sky-omnibar-iframe-expanded')).toBe(expanded);
  }

  function destroyOmnibar() {
    BBOmnibar.destroy();
  }

  let navigateSpy: jasmine.Spy;
  let postOmnibarMessageSpy: jasmine.Spy;
  let messageIsFromOmnibarSpy: jasmine.Spy;
  let getTokenSpy: jasmine.Spy;
  let startTrackingSpy: jasmine.Spy;

  let messageIsFromOmnibarReturnValue = true;
  let getTokenFake: () => Promise<string>;

  beforeAll(() => {
    navigateSpy = spyOn(BBAuthNavigator, 'navigate');
    postOmnibarMessageSpy = spyOn(BBAuthInterop, 'postOmnibarMessage');

    messageIsFromOmnibarSpy = spyOn(
      BBAuthInterop,
      'messageIsFromOmnibar'
    ).and.callFake(() => {
      return messageIsFromOmnibarReturnValue;
    });

    getTokenSpy = spyOn(
      BBAuth,
      'getToken'
    ).and.callFake(() => {
      return getTokenFake();
    });

    // This effectively disables activity tracking.  Without this, the test page could potentially redirect to
    // the login page during the test run when it detects no activity.
    startTrackingSpy = spyOn(BBOmnibarUserActivity, 'startTracking');

    // Disable animations so computed styles can be validated without waiting for animations to complete.
    const styleEl = document.createElement('style');

    styleEl.appendChild(document.createTextNode('* { transition: none !important }'));

    document.head.appendChild(styleEl);
  });

  beforeEach(() => {
    delete (window as any).BBHELP;

    getTokenFake = () => Promise.resolve('some_token');

    navigateSpy.calls.reset();
    postOmnibarMessageSpy.calls.reset();
    messageIsFromOmnibarSpy.calls.reset();
    getTokenSpy.calls.reset();
    startTrackingSpy.calls.reset();

    postOmnibarMessageSpy.and.stub();
    startTrackingSpy.and.stub();
  });

  afterEach(() => {
    messageIsFromOmnibarReturnValue = true;

    navigateSpy.calls.reset();
    postOmnibarMessageSpy.calls.reset();
    messageIsFromOmnibarSpy.calls.reset();
    getTokenSpy.calls.reset();

    postOmnibarMessageSpy.and.stub();

    destroyOmnibar();
  });

  it('should load the omnibar IFRAME', () => {
    loadOmnibar();

    const iframeEl = getIframeEl();

    expect(iframeEl).not.toBeNull();

    // The IFRAME should be inserted at the very top of the DOM to enforce the correct
    // tab order between the omnibar and the host page's content.
    expect(document.body.firstChild).toBe(iframeEl);

    expect(iframeEl.src).toBe(BASE_URL);
    expect(iframeEl.title).toBe('Navigation');
  });

  it('should display a placeholder element until the omnibar is ready for display', () => {
    loadOmnibar();

    const placeholderEl = getPlaceholderEl();
    const iframeEl = getIframeEl();

    expect(getComputedStyle(placeholderEl).display).toBe('block');
    expect(getComputedStyle(iframeEl).visibility).toBe('hidden');

    fireMessageEvent({
      messageType: 'display-ready'
    });

    expect(getComputedStyle(placeholderEl).display).toBe('none');
    expect(getComputedStyle(iframeEl).visibility).toBe('visible');
  });

  it('should style the placeholder element based on the provided theme', () => {
    loadOmnibar({
      theme: {
        backgroundColor: 'rgb(123, 0, 4)'
      }
    });

    const placeholderEl = getPlaceholderEl();
    const placeholderStyle = getComputedStyle(placeholderEl);

    expect(placeholderStyle.backgroundColor).toBe('rgb(123, 0, 4)');
    expect(placeholderStyle.borderTopColor).toBe('rgb(0, 180, 241)');
  });

  it('should style the placeholder element accent based on the provided theme', () => {
    loadOmnibar({
      theme: {
        accent: {
          color: 'rgb(3, 5, 6)'
        }
      }
    });

    const placeholderEl = getPlaceholderEl();
    const placeholderStyle = getComputedStyle(placeholderEl);

    expect(placeholderStyle.backgroundColor).toBe('rgb(77, 82, 89)');
    expect(placeholderStyle.borderTopColor).toBe('rgb(3, 5, 6)');
  });

  it('should not show a placeholder accent when the provided theme removes it', () => {
    loadOmnibar({
      theme: {
        accent: false
      }
    });

    const placeholderEl = getPlaceholderEl();
    const placeholderStyle = getComputedStyle(placeholderEl);

    expect(placeholderStyle.backgroundColor).toBe('rgb(77, 82, 89)');
    expect(placeholderStyle.borderTopColor).toBe('rgb(77, 82, 89)');
  });

  it('should disable redirect when the session ends and allow anonymous is true', (done) => {
    postOmnibarMessageSpy.and.callFake(
      (iframeEl: HTMLIFrameElement, data: any) => {
        if (data.messageType === 'token') {
          expect(startTrackingSpy).toHaveBeenCalledWith(
            jasmine.any(Function),
            jasmine.any(Function),
            jasmine.any(Function),
            true,
            undefined
          );

          done();
        }
    });

    loadOmnibar({
      allowAnonymous: true
    });

    fireMessageEvent({
      messageType: 'get-token',
      tokenRequestId: 123
    });
  });

  describe('interop with host page', () => {
    it('should ignore messages that do not originate from omnibar', () => {
      messageIsFromOmnibarReturnValue = false;

      loadOmnibar();

      fireMessageEvent(
        {
          messageType: 'expand'
        },
        false
      );

      validateExpanded(false);
    });

    it('should expand and collapse', () => {
      loadOmnibar();

      fireMessageEvent({
        messageType: 'expand'
      });

      validateExpanded(true);

      fireMessageEvent({
        messageType: 'collapse'
      });

      validateExpanded(false);
    });

    it('should navigate by URL', () => {
      loadOmnibar();

      fireMessageEvent({
        messageType: 'navigate-url',
        url: 'https://example.com/'
      });

      expect(navigateSpy).toHaveBeenCalledWith('https://example.com/');
    });

    it('should navigate by nav item', () => {
      loadOmnibar();

      fireMessageEvent({
        messageType: 'navigate',
        navItem: {
          url: 'https://example.com/'
        }
      });

      expect(navigateSpy).toHaveBeenCalledWith('https://example.com/');
    });

    it('should allow the host page to handle navigation when navigating by nav item', () => {
      loadOmnibar({
        nav: {
          beforeNavCallback(item: BBOmnibarNavigationItem) {
            return false;
          }
        }
      });

      fireMessageEvent({
        messageType: 'navigate',
        navItem: {
          url: 'https://example.com/'
        }
      });

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should call the config\'s onSearch() callback when search is invoked', () => {
      const config = {
        onSearch: (searchArgs: BBOmnibarSearchArgs) => {
          return Promise.resolve(undefined);
        }
      };

      const onSearchSpy = spyOn(config, 'onSearch').and.callThrough();

      loadOmnibar(config);

      fireMessageEvent({
        messageType: 'search',
        searchArgs: {
          searchText: 'abc'
        }
      });

      expect(onSearchSpy).toHaveBeenCalledWith({
        searchText: 'abc'
      });
    });

    it('should not attempt to call the config\'s onSearch() callback when it is not defined', () => {
      loadOmnibar();

      fireMessageEvent({
        messageType: 'search',
        searchArgs: {
          searchText: 'abc'
        }
      });

      // Should not throw an error.
    });

    it('should call the notification config\'s onReady() callback', () => {
      const config = {
        notifications: {
          onReady: jasmine.createSpy('onReady')
        }
      };

      loadOmnibar(config);

      fireMessageEvent({
        messageType: 'ready'
      });

      expect(config.notifications.onReady).toHaveBeenCalled();
    });

    it('should call the notification config\'s onNotificationRead() callback', () => {
      const config = {
        notifications: {
          onNotificationRead: jasmine.createSpy('onNotificationRead'),
          onReady: jasmine.createSpy('onReady')
        }
      };

      loadOmnibar(config);

      fireMessageEvent({
        messageType: 'notification-read',
        notification: {
          id: 1
        }
      });

      expect(config.notifications.onNotificationRead).toHaveBeenCalledWith({
        id: 1
      });
    });

    it('should not call the notification config\'s onNotificationRead() callback if not specified', () => {
      const config = {
        notifications: {
          onReady: jasmine.createSpy('onReady')
        }
      };

      loadOmnibar(config);

      fireMessageEvent({
        messageType: 'notification-read',
        notification: {
          id: 1
        }
      });

      // Should not throw an error.
    });

    it('should open the help widget if the help widget is present on the page', () => {
      loadOmnibar();

      const openSpy = jasmine.createSpy('open');

      (window as any).BBHELP = {
        HelpWidget: {
          open: openSpy
        }
      };

      fireMessageEvent({
        messageType: 'help-open'
      });

      expect(openSpy).toHaveBeenCalled();
    });

    it('should not attempt to open the help widget if the help widget is not present on the page', () => {
      loadOmnibar();

      fireMessageEvent({
        messageType: 'help-open'
      });

      // Should not throw an error.
    });

    it('should provide a way to renew the user session', () => {
      loadOmnibar();

      const userRenewedSessionSpy = spyOn(BBOmnibarUserActivity, 'userRenewedSession');

      fireMessageEvent({
        messageType: 'session-renew'
      });

      expect(userRenewedSessionSpy).toHaveBeenCalled();
    });

    it('should display the current environment when specified by the omnibar', () => {
      loadOmnibar();

      const environmentEl = document.querySelector('.sky-omnibar-environment') as any;

      const validateVisible = (visible: boolean) => {
        expect(document.body.classList.contains('sky-omnibar-environment-visible')).toBe(visible);
        expect(getComputedStyle(environmentEl).height).toBe(visible ? '24px' : '0px');
        expect(environmentEl.innerText.trim()).toBe(visible ? 'Environment name' : '');
      };

      validateVisible(false);

      fireMessageEvent({
        messageType: 'environment-update',
        name: 'Environment name'
      });

      validateVisible(true);

      fireMessageEvent({
        messageType: 'environment-update',
        name: undefined
      });

      validateVisible(false);
    });

    it('should restart activity tracking when the legacy session keep-alive URL changes', () => {
      loadOmnibar();

      startTrackingSpy.calls.reset();

      fireMessageEvent({
        messageType: 'legacy-keep-alive-url-change',
        url: 'https://example.com/track'
      });

      expect(startTrackingSpy).toHaveBeenCalledWith(
        jasmine.any(Function),
        jasmine.any(Function),
        jasmine.any(Function),
        undefined,
        'https://example.com/track'
      );
    });

    it('should show the inactivity prompt', (done) => {
      const showSpy = spyOn(BBOmnibarUserActivityPrompt, 'show');

      startTrackingSpy.and.callFake((
        refreshUserCallback: () => void,
        showInactivityCallback: () => void
      ) => {
        showInactivityCallback();

        expect(showSpy).toHaveBeenCalled();

        done();
      });

      loadOmnibar();

      // Getting a token starts the activity tracking.
      fireMessageEvent({
        messageType: 'get-token'
      });
    });

    it('should renew the session when the user dismisses the inactivity prompt', (done) => {
      spyOn(BBOmnibarUserActivityPrompt, 'show').and.callFake((args: BBOmnibarUserActivityPromptShowArgs) => {
        args.sessionRenewCallback();
      });

      const userRenewedSessionSpy = spyOn(BBOmnibarUserActivity, 'userRenewedSession');

      startTrackingSpy.and.callFake((
        refreshUserCallback: () => void,
        showInactivityCallback: () => void
      ) => {
        showInactivityCallback();

        expect(userRenewedSessionSpy).toHaveBeenCalled();

        done();
      });

      loadOmnibar();

      // Getting a token starts the activity tracking.
      fireMessageEvent({
        messageType: 'get-token'
      });
    });

    it('should hide the inactivity prompt', (done) => {
      const hideSpy = spyOn(BBOmnibarUserActivityPrompt, 'hide');

      startTrackingSpy.and.callFake((
        refreshUserCallback: () => void,
        showInactivityCallback: () => void,
        hideInactivityCallback: () => void
      ) => {
        hideInactivityCallback();

        expect(hideSpy).toHaveBeenCalled();

        done();
      });

      loadOmnibar();

      // Getting a token starts the activity tracking.
      fireMessageEvent({
        messageType: 'get-token'
      });
    });

  });

  describe('interop with omnibar', () => {

    it('should notify the omnibar when navigation is ready to be loaded', () => {
      const envId = 'abc';
      const svcId = 'xyz';
      const leId = '123';
      const compactNavOnly = true;
      const navVersion = 'test';
      const hideResourceLinks = true;

      const localNavItems: BBOmnibarNavigationItem[] = [
        {
          title: 'Test',
          url: 'https://example.com/'
        }
      ];

      const theme: BBOmnibarTheme = {
        backgroundColor: 'green'
      };

      loadOmnibar({
        compactNavOnly,
        envId,
        hideResourceLinks,
        leId,
        nav: {
          localNavItems,
          services: [
            {
              items: [
                {
                  title: 'Some item',
                  url: 'https://example.com/'
                }
              ],
              title: 'Some service'
            }
          ]
        },
        navVersion,
        onSearch: (searchArgs) => {
          return undefined;
        },
        svcId,
        theme
      });

      fireMessageEvent({
        messageType: 'ready'
      });

      expect(postOmnibarMessageSpy.calls.argsFor(0)).toEqual([
        getIframeEl(),
        {
          messageType: 'host-ready'
        }
      ]);

      expect(postOmnibarMessageSpy.calls.argsFor(1)).toEqual([
        getIframeEl(),
        {
          compactNavOnly,
          enableHelp: undefined,
          envId,
          hideResourceLinks,
          leId,
          localNavItems,
          localNotifications: false,
          localSearch: true,
          messageType: 'nav-ready',
          navVersion,
          services: [
            {
              items: [
                {
                  title: 'Some item',
                  url: 'https://example.com/'
                }
              ],
              title: 'Some service'
            }
          ],
          svcId,
          theme
        }
      ]);
    });

    it('should notify the omnibar when the host page\'s URL changes', () => {
      function validateHistoryMonkeyPatch(historyFn: string) {
        postOmnibarMessageSpy.calls.reset();

        (history as any)[historyFn]({}, '', '/test');

        expect(postOmnibarMessageSpy).toHaveBeenCalledWith(
          iframeEl,
          {
            href: location.href,
            messageType: 'location-change'
          }
        );
      }

      loadOmnibar();

      const iframeEl = getIframeEl();

      spyOn(history, 'pushState');
      spyOn(history, 'replaceState');

      // Do this after the pushState/replaceState spies are established since the omnibar
      // monkey-patches it once the host page is ready.
      fireMessageEvent({
        messageType: 'ready'
      });

      validateHistoryMonkeyPatch('pushState');
      validateHistoryMonkeyPatch('replaceState');
    });

    it('should notify the omnibar when search results are available', (done) => {
      postOmnibarMessageSpy.and.callFake(() => {
        expect(postOmnibarMessageSpy).toHaveBeenCalledWith(
          getIframeEl(),
          {
            messageType: 'search-results',
            results: {
              items: [
                {
                  title: 'test',
                  url: 'https://example.com/'
                }
              ],
              searchArgs: {
                searchText: 'abc'
              }
            } as BBOmnibarSearchResults
          }
        );

        done();
      });

      const config = {
        onSearch: (searchArgs: BBOmnibarSearchArgs) => {
          return Promise.resolve({
            searchArgs,
            items: [
              {
                title: 'test',
                url: 'https://example.com/'
              }
            ]
          });
        }
      };

      loadOmnibar(config);

      fireMessageEvent({
        messageType: 'search',
        searchArgs: {
          searchText: 'abc'
        }
      });
    });

    it('should notify the omnibar when a requested token is available', (done) => {
      postOmnibarMessageSpy.and.callFake(() => {
        expect(postOmnibarMessageSpy).toHaveBeenCalledWith(
          getIframeEl(),
          {
            messageType: 'token',
            token: 'some_token',
            tokenRequestId: 123
          }
        );

        done();
      });

      loadOmnibar();

      fireMessageEvent({
        messageType: 'get-token',
        tokenRequestId: 123
      });
    });

    it('should notify the omnibar when a requested token is not available', (done) => {
      postOmnibarMessageSpy.and.callFake(() => {
        expect(postOmnibarMessageSpy).toHaveBeenCalledWith(
          getIframeEl(),
          {
            messageType: 'token-fail',
            reason: 'The user is not logged in.',
            tokenRequestId: 123
          }
        );

        done();
      });

      getTokenFake = () => {
        return Promise.reject('The user is not logged in.');
      };

      loadOmnibar();

      fireMessageEvent({
        disableRedirect: false,
        messageType: 'get-token',
        tokenRequestId: 123
      });
    });

    it('should notify the omnibar when the current user data should be refreshed', (done) => {
      postOmnibarMessageSpy.and.callFake(
        (iframeEl: HTMLIFrameElement, data: any) => {
          // The first call to this spy will be to return the requested token, so ignore that
          // one and look for the refresh-user call.
          if (data.messageType === 'refresh-user') {
            expect(postOmnibarMessageSpy).toHaveBeenCalledWith(
              getIframeEl(),
              {
                messageType: 'refresh-user',
                token: 'some_token'
              }
            );

            done();
          }
        }
      );

      startTrackingSpy.and.callFake((refreshUserCallback: () => void) => {
        refreshUserCallback();
      });

      loadOmnibar();

      fireMessageEvent({
        messageType: 'get-token',
        tokenRequestId: 123
      });
    });

    it('should notify the omnibar when the current user has logged out', (done) => {
      postOmnibarMessageSpy.and.callFake(
        (iframeEl: HTMLIFrameElement, data: any) => {
          // The first call to this spy will be to return the requested token, so ignore that
          // one and look for the refresh-user call.
          if (data.messageType === 'refresh-user') {
            expect(postOmnibarMessageSpy).toHaveBeenCalledWith(
              getIframeEl(),
              {
                messageType: 'refresh-user',
                token: undefined
              }
            );

            done();
          }
        }
      );

      startTrackingSpy.and.callFake((refreshUserCallback: () => void) => {
        refreshUserCallback();
      });

      getTokenFake = () => {
        return Promise.reject('The user is not logged in.');
      };

      loadOmnibar();

      fireMessageEvent({
        messageType: 'get-token',
        tokenRequestId: 123
      });
    });

    it('should notify the omnibar when notifications are updated', () => {
      const notifications = {
        items: [
          {
            id: 1,
            title: 'Hi'
          }
        ]
      };

      const config: BBOmnibarConfig = {
        notifications: {
          onReady: (readyArgs) => {
            readyArgs.updateNotifications(notifications);
          }
        }
      };

      loadOmnibar(config);

      fireMessageEvent({
        messageType: 'ready'
      });

      expect(postOmnibarMessageSpy.calls.argsFor(2)).toEqual([
        getIframeEl(),
        {
          messageType: 'notifications-update',
          notifications
        }
      ]);
    });

    it('should notify the omnibar when update() is called', (done) => {
      const updateArgs: BBOmnibarUpdateArgs = {
        compactNavOnly: true,
        nav: {
          services: [
            {
              title: 'Test Service'
            }
          ]
        },
        theme: {
          backgroundColor: '#abc'
        }
      };

      postOmnibarMessageSpy.and.callFake(() => {
        expect(postOmnibarMessageSpy).toHaveBeenCalledWith(
          getIframeEl(),
          {
            messageType: 'update',
            updateArgs
          }
        );

        done();
      });

      loadOmnibar();

      BBOmnibar.update(updateArgs);
    });

  });

});
