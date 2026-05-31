import { requestUrl, RequestUrlParam } from "obsidian"
import { logger } from "@/utils/logger";

const langMap: Record<string, string> = {
    zh: "ZH",
    en: "EN",
    jp: "JA",
    fr: "FR",
    de: "DE",
    es: "ES",
};

export async function search(text: string, lang: string = ""): Promise<string | undefined> {
    let target = (/[\u4e00-\u9fa5]/.test(text) && !/[\u0800-\u4e00]/.test(text)) // chinese
        ? langMap[lang] || "ZH"
        : "ZH";
    const payload = {
        text,
        source_lang: "auto",
        target_lang: target,
    };

    const data: RequestUrlParam = {
        url: "https://deeplx.vercel.app/translate",
        method: "POST",
        body: JSON.stringify(payload),
        contentType: "application/json"
    };

    try {
        let res = (await withTimeout(requestUrl(data), 8000)).json;
        if (res.code !== 200) throw new Error("Deeplx api source error.");

        return res.data;
    } catch (err) {
        logger.error(err.message)
    }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DeepL request timed out")), ms)
    );
    return Promise.race([promise, timeout]);
}