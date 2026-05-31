import { Notice } from "obsidian";

export async function fetchWithRetry(
    url: string,
    options?: RequestInit,
    retries: number = 2,
    timeoutMs: number = 8000
): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok && i < retries) {
                await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
                continue;
            }
            return response;
        } catch (error) {
            if (i === retries) {
                throw error;
            }
            await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw new Error("All fetch retries exhausted");
}

export function handleFetchError(err: unknown, context: string): void {
    if (err instanceof DOMException && err.name === "AbortError") {
        new Notice(`${context}: 请求超时`);
        return;
    }
    if (err instanceof TypeError && err.message.includes("fetch")) {
        new Notice(`${context}: 网络连接失败`);
        return;
    }
    new Notice(`${context}: 请求失败`);
}
