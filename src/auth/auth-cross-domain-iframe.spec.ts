import { BBAuthDomUtility } from '../shared/dom-utility';
import { BBAuthNavigator } from '../shared/navigator';
import { BBAuthCrossDomainIframe } from './auth-cross-domain-iframe';

function IFrameMock(frame: HTMLIFrameElement, redirect?: boolean) {
  // This mock should match the code at the URL
  const SOURCE = 'security-token-svc';
  const HOST = 'auth-client';
  console.log(frame.contentWindow);
  frame.contentWindow.addEventListener('message', (msg: any) => {
    if (msg.data.source !== HOST) { return; }
    if (msg.data.messageType === 'ready') {
      window.postMessage({messageType: 'ready', source: SOURCE}, '*');
    } else if (msg.data.messageType === 'getToken') {
      getTokenCalls += 1;
      if (redirect) {
        spyOn(BBAuthCrossDomainIframe, 'inIframe').and.returnValue(true);
        BBAuthCrossDomainIframe.postRedirectMessage('myURL', null);
        // window.postMessage({
        //   messageType: 'redirect',
        //   source: SOURCE,
        //   value: {
        //     replace: null,
        //     url: 'myURL'
        //   }
        // }, '*');
      } else {
        window.postMessage({
          messageType: 'getToken',
          source: SOURCE,
          value: 'accessToken!'
        }, '*');
      }
    }
  });
}

let getTokenCalls: number;

describe('Auth Cross Domain Iframe', () => {
  let fakeIframe: HTMLIFrameElement;

  beforeEach(() => {
    fakeIframe = document.createElement('iframe');
    getTokenCalls = 0;
  });

  describe('getToken', () => {
    it('gets or creates an iframe then returns the token promise', () => {
      const getOrMakeFrameSpy = spyOn(BBAuthCrossDomainIframe, 'getOrMakeIframe').and.returnValue(fakeIframe);
      const getTokenFromIframeSpy = spyOn(BBAuthCrossDomainIframe, 'getTokenFromIframe');

      BBAuthCrossDomainIframe.getToken();

      expect(getOrMakeFrameSpy).toHaveBeenCalled();
      expect(getTokenFromIframeSpy).toHaveBeenCalledWith(fakeIframe);
    });
  });

  describe('getOrMakeIframe', () => {
    it('creates a new frame if none exist', () => {
      const getElementSpy = spyOn(document, 'getElementById').and.callThrough();
      const requestSpy = spyOn(BBAuthDomUtility, 'addIframe');

      BBAuthCrossDomainIframe.getOrMakeIframe();

      expect(getElementSpy).toHaveBeenCalledWith('auth-cross-domain-iframe');
      expect(requestSpy).toHaveBeenCalledWith(
        'https://s21aidntoken00blkbapp01.nxt.blackbaud.com/Iframes/CrossDomainAuthFrame.html',
        'auth-cross-domain-iframe',
        ''
      );
    });

    it('uses an existing frame if one exists', () => {
      const getElementSpy = spyOn(document, 'getElementById').and.returnValue(fakeIframe);
      const requestSpy = spyOn(BBAuthDomUtility, 'addIframe');

      BBAuthCrossDomainIframe.getOrMakeIframe();

      expect(getElementSpy).toHaveBeenCalledWith('auth-cross-domain-iframe');
      expect(requestSpy).not.toHaveBeenCalled();
    });
  });

  describe('getTokenFromIframe', () => {
    it('communicates with the iframe via "ready" and "getToken" and kicks off "ready"', (done) => {
      fakeIframe = BBAuthDomUtility.addIframe('', 'auth-cross-domain-iframe', '');
      IFrameMock(fakeIframe);

      BBAuthCrossDomainIframe.getTokenFromIframe(fakeIframe)
        .then((tokenResonse) => {
          expect(tokenResonse.access_token).toEqual('accessToken!');
          expect(tokenResonse.expires_in).toEqual(0);
          done();
        });
    });

    it('only calls the iframe once if the getToken is called', (done) => {
      fakeIframe = BBAuthDomUtility.addIframe('', 'auth-cross-domain-iframe', '');
      IFrameMock(fakeIframe);

      BBAuthCrossDomainIframe.getTokenFromIframe(fakeIframe)
        .then((tokenResonse) => {
          BBAuthCrossDomainIframe.getTokenFromIframe(fakeIframe)
            .then((tr) => {
              expect(getTokenCalls).toEqual(2);
              done();
            });

        });
    });

    it('listens to the rediret message', (done) => {
      const navSpy = spyOn(BBAuthNavigator, 'navigate');
      fakeIframe = BBAuthDomUtility.addIframe('', 'auth-cross-domain-iframe', '');
      IFrameMock(fakeIframe, true);

      BBAuthCrossDomainIframe.getTokenFromIframe(fakeIframe)
        .then((tokenResonse) => {
          expect(tokenResonse).toBeNull();
          expect(navSpy).toHaveBeenCalledWith('myURL', null);
          done();
        });
    });
  });

  describe('inIframe', () => {
    it('returns true because testing is done in an iframe', () => {
      expect(BBAuthCrossDomainIframe.inIframe()).toBe(true);
    });
  });

});
