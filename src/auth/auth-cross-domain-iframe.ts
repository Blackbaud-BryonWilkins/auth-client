//#region imports

import {
  BBAuthDomUtility
} from '../shared/dom-utility';

import { BBAuthNavigator } from '../shared/navigator';

import { BBAuthTokenResponse } from './bbauth-token-response';

//#endregion
const URL = 'https://s21aidntoken00blkbapp01.nxt.blackbaud.com/Iframes/CrossDomainAuthFrame.html'; // URL to get IFrame
const HOST = 'security-token-svc';
const SOURCE = 'auth-client';

export class BBAuthCrossDomainIframe {

  public static getToken(): Promise<BBAuthTokenResponse> {
    return this.getTokenFromIframe(this.getOrMakeIframe());
  }

  public static getOrMakeIframe(): HTMLIFrameElement {
    let iframeEl = document.getElementById('auth-cross-domain-iframe') as HTMLIFrameElement;
    // if iframe doesn't exist, make it
    if (!iframeEl) {
      iframeEl = BBAuthDomUtility.addIframe(
        URL,
        'auth-cross-domain-iframe',
        ''
      );
    }
    return iframeEl;
  }

  public static getTokenFromIframe(iframeEl: HTMLIFrameElement): Promise<BBAuthTokenResponse> {
    return new Promise<BBAuthTokenResponse>((resolve) => {
      window.addEventListener('message', function handleMessageFromIframe(msg: any) {
        if (msg.data.source !== HOST) { return; }
        if (msg.data.messageType === 'ready') {
          iframeEl.contentWindow.postMessage({
            messageType: 'getToken',
            source: SOURCE
          }, '*'); // set this * to something else
        } else if (msg.data.messageType === 'redirect') {
          BBAuthNavigator.navigate(msg.data.value.url, msg.data.value.replace);
          resolve(null);
        } else if (msg.data.messageType === 'getToken') {
          const tokenResponse: BBAuthTokenResponse = {
            access_token: msg.data['value'],
            expires_in: 0
          };
          // this is required to prevent subsequent calls of getTOkenFromIFrame to not make extra calls to the IFrame
          window.removeEventListener('message', handleMessageFromIframe);
          resolve(tokenResponse);
        }
      });
      iframeEl.contentWindow.postMessage({messageType: 'ready', source: SOURCE}, '*');
    });
  }

  // This should be called by the iframe when we are intended to navigate to a page
  public static postRedirectMessage(url: string, replace?: boolean) {
    if (this.inIframe()) {
      this.parentWindow().postMessage({
        messageType: 'redirect',
        source: HOST,
        value: {url, replace}
      }, '*');
    }
  }

  // Used to tell if you're in an iframe when this call is made
  public static inIframe(): boolean {
    return window.self !== window.top;
  }

  public static parentWindow(): Window {
    return window.parent;
  }
}
