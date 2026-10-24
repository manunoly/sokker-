/** The port ID is minted by the worker; a request may never declare its owner. */
export function isAuthorizedSender(
    sender: chrome.runtime.MessageSender,
): boolean {
    if (sender.id !== chrome.runtime.id) return false;
    try {
        const url = new URL(sender.url ?? '');
        return (
            (url.protocol === 'https:' &&
                (url.hostname === 'sokker.org' ||
                    url.hostname.endsWith('.sokker.org'))) ||
            (url.protocol === 'chrome-extension:' &&
                url.hostname === chrome.runtime.id)
        );
    } catch {
        return false;
    }
}
export function getMessageOwner(
    sender: chrome.runtime.MessageSender,
    portId?: string,
): string | null {
    if (!isAuthorizedSender(sender)) return null;
    const context = sender.documentId
        ? `document:${sender.documentId}`
        : portId
          ? `port:${portId}`
          : null;
    return context
        ? `${sender.id}:${sender.tab?.id ?? 'extension'}:${sender.frameId ?? 0}:${context}`
        : null;
}
