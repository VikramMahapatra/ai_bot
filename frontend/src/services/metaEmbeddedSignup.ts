let fbSdkLoadPromise: Promise<void> | null = null;

const FB_SDK_SCRIPT_ID = 'facebook-jssdk';

const getWindowAny = () => window as any;

export const loadFacebookSdk = async (appId: string, version = 'v19.0'): Promise<void> => {
  if (!appId) {
    throw new Error('VITE_META_APP_ID is missing.');
  }

  const win = getWindowAny();
  if (win.FB && typeof win.FB.init === 'function') {
    win.FB.init({
      appId,
      cookie: true,
      xfbml: false,
      version,
    });
    return;
  }

  if (fbSdkLoadPromise) {
    return fbSdkLoadPromise;
  }

  fbSdkLoadPromise = new Promise<void>((resolve, reject) => {
    let settled = false;

    const finishResolve = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const finishReject = (error: Error) => {
      if (!settled) {
        settled = true;
        // Allow retrying SDK load after a failure.
        fbSdkLoadPromise = null;
        reject(error);
      }
    };

    win.fbAsyncInit = function () {
      try {
        win.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version,
        });
        finishResolve();
      } catch (err: any) {
        finishReject(new Error(err?.message || 'Failed to initialize Facebook SDK'));
      }
    };

    const existingScript = document.getElementById(FB_SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = FB_SDK_SCRIPT_ID;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onerror = () => finishReject(new Error('Could not load Facebook SDK script.'));
      document.body.appendChild(script);
    } else {
      existingScript.addEventListener(
        'load',
        () => {
          if (settled) {
            return;
          }
          if (win.FB && typeof win.FB.init === 'function') {
            try {
              win.FB.init({
                appId,
                cookie: true,
                xfbml: false,
                version,
              });
              finishResolve();
            } catch (err: any) {
              finishReject(new Error(err?.message || 'Failed to initialize Facebook SDK'));
            }
          }
        },
        { once: true }
      );
    }

    window.setTimeout(() => {
      if (!settled) {
        finishReject(new Error('Facebook SDK load timed out.'));
      }
    }, 15000);
  });

  return fbSdkLoadPromise;
};

export const launchWhatsAppEmbeddedSignup = async (configId: string): Promise<string> => {
  if (!configId) {
    throw new Error('VITE_META_EMBEDDED_SIGNUP_CONFIG_ID is missing.');
  }

  const win = getWindowAny();
  const fb = win.FB;
  if (!fb || typeof fb.login !== 'function') {
    throw new Error('Facebook SDK is not initialized.');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const finishResolve = (code: string) => {
      if (!settled) {
        settled = true;
        resolve(code);
      }
    };

    const finishReject = (message: string) => {
      if (!settled) {
        settled = true;
        reject(new Error(message));
      }
    };

    const timer = window.setTimeout(() => {
      finishReject('Meta popup did not complete. Check popup blocker and try again.');
    }, 20000);

    fb.login(
      (response: any) => {
        window.clearTimeout(timer);
        const code = response?.authResponse?.code;
        if (code) {
          finishResolve(code);
          return;
        }

        finishReject('Meta signup cancelled or no authorization code returned.');
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          feature: 'whatsapp_embedded_signup',
        },
      }
    );
  });
};
