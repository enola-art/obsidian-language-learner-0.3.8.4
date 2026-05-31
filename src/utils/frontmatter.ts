import { App, TFile, parseYaml, stringifyYaml } from "obsidian";

type FrontMatter = { [K in string]: string };

export class FrontMatterManager {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    // 解析
    async loadFrontMatter(file: TFile): Promise<FrontMatter> {
        try {
            let res = {} as FrontMatter;
            let text = await this.app.vault.read(file);

            let match = text.match(/^\n*---\n([\s\S]+)\n---/);
            if (match) {
                res = parseYaml(match[1]);
            }

            return res;
        } catch (e) {
            console.error("[FrontMatter] load error:", e);
            return {} as FrontMatter;
        }
    }

    async storeFrontMatter(file: TFile, fm: FrontMatter) {
        try {
            if (Object.keys(fm).length === 0) {
                return;
            }

            let text = await this.app.vault.read(file);
            let match = text.match(/^\n*---\n([\s\S]+)\n---/);

            let newText = "";
            let newFront = stringifyYaml(fm);
            if (match) {
                newText = text.replace(/^\n*---\n([\s\S]+)\n---/, `---\n${newFront}---`);
            } else {
                newText = `---\n${newFront}---\n\n` + text;
            }

            await this.app.vault.modify(file, newText);
        } catch (e) {
            console.error("[FrontMatter] store error:", e);
        }
    }

    // 读取值
    async getFrontMatter(file: TFile, key: string): Promise<string> {
        let frontmatter = await this.loadFrontMatter(file);

        return frontmatter[key];
    }

    // 修改
    async setFrontMatter(file: TFile, key: string, value: string) {
        let fm = await this.loadFrontMatter(file);

        fm[key] = value;

        this.storeFrontMatter(file, fm);
    }
}