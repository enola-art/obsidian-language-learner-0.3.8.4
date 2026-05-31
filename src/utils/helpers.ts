import { logger } from "./logger";

export function playAudio(src: string) {
    if (!src) {
        logger.warn("playAudio: empty audio source");
        return;
    }

    try {
        const audio = new Audio(src);
        
        audio.addEventListener("error", (e) => {
            logger.warn("Audio playback failed:", src, e);
        });
        
        audio.addEventListener("canplay", () => {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((err) => {
                    logger.warn("Audio play() was rejected:", err);
                });
            }
        });

        audio.load();
    } catch (error) {
        logger.error("Failed to create Audio object:", error);
    }
}
