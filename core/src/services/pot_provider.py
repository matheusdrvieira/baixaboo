import asyncio
import importlib

import yt_dlp.plugins
from yt_dlp.extractor.youtube.pot._registry import _pot_providers
from yt_dlp.extractor.youtube.pot.provider import PoTokenProviderError, register_preference


yt_dlp.plugins.load_all_plugins()
WPC_PROVIDER = next(
    provider
    for provider in _pot_providers.value.values()
    if provider.PROVIDER_NAME == "wpc"
)
WPC_MODULE = importlib.import_module(WPC_PROVIDER.__module__)
TOKEN_ATTEMPTS = 3
TOKEN_TIMEOUT_SECONDS = 20

_original_get_nodriver_config = WPC_PROVIDER.get_nodriver_config
_original_close = WPC_PROVIDER.close


def _container_browser_config(self, proxy=None):
    config = _original_get_nodriver_config(self, proxy)
    # Chromium's setuid sandbox is unavailable inside the Docker container.
    # The browser still runs as the dedicated, unprivileged `baixaboo` user.
    config.sandbox = False
    return config


def _close_and_reap_browser(self):
    browser = self._browser
    process = getattr(browser, "_process", None)
    try:
        _original_close(self)
    except Exception as error:
        self._browser = None
        self.logger.warning(
            f"Could not close the WPC browser cleanly: {type(error).__name__}"
        )
    if process is None:
        return
    try:
        self._loop.run_until_complete(asyncio.wait_for(process.wait(), timeout=5))
    except Exception:
        if process.returncode is None:
            process.kill()
        self._loop.run_until_complete(process.wait())


def _request_token_with_retries(self, request):
    proxy = request.request_proxy
    if proxy:
        proxy = proxy.replace("socks5h", "socks5").replace("socks4a", "socks4")

    for attempt in range(1, TOKEN_ATTEMPTS + 1):
        try:
            if not self._browser or self._browser.stopped:
                browser_config = self.get_nodriver_config(proxy)
                self._browser = self._loop.run_until_complete(
                    asyncio.wait_for(
                        WPC_MODULE.launch_browser(browser_config),
                        timeout=TOKEN_TIMEOUT_SECONDS,
                    )
                )

            content_binding = WPC_MODULE.get_webpo_content_binding(request)[0]
            token = self._loop.run_until_complete(
                asyncio.wait_for(
                    WPC_MODULE.mint_po_token(
                        tab=self._browser.main_tab,
                        logger=self.logger,
                        content_binding=content_binding,
                    ),
                    timeout=TOKEN_TIMEOUT_SECONDS,
                )
            )
            return WPC_MODULE.PoTokenResponse(po_token=token)
        except Exception as error:
            self.logger.warning(
                f"WPC PO Token attempt {attempt}/{TOKEN_ATTEMPTS} failed: "
                f"{type(error).__name__}"
            )
            self.close()
            if attempt == TOKEN_ATTEMPTS:
                raise PoTokenProviderError(
                    "WPC PO Token generation failed after retries",
                    expected=True,
                ) from error

    raise PoTokenProviderError("WPC PO Token generation failed", expected=True)


WPC_PROVIDER.get_nodriver_config = _container_browser_config
WPC_PROVIDER.close = _close_and_reap_browser
WPC_PROVIDER._real_request_pot = _request_token_with_retries


@register_preference(WPC_PROVIDER)
def prefer_browser_token_provider(_provider, _request):
    return 1_000
