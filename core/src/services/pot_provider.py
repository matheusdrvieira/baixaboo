import asyncio

import yt_dlp.plugins
from yt_dlp.extractor.youtube.pot._registry import _pot_providers
from yt_dlp.extractor.youtube.pot.provider import register_preference


yt_dlp.plugins.load_all_plugins()
WPC_PROVIDER = next(
    provider
    for provider in _pot_providers.value.values()
    if provider.PROVIDER_NAME == "wpc"
)

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
    _original_close(self)
    if process is None:
        return
    try:
        self._loop.run_until_complete(asyncio.wait_for(process.wait(), timeout=5))
    except TimeoutError:
        process.kill()
        self._loop.run_until_complete(process.wait())


WPC_PROVIDER.get_nodriver_config = _container_browser_config
WPC_PROVIDER.close = _close_and_reap_browser


@register_preference(WPC_PROVIDER)
def prefer_browser_token_provider(_provider, _request):
    return 1_000
