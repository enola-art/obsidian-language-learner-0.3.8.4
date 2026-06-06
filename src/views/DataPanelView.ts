import { ItemView, WorkspaceLeaf } from "obsidian";
import { createApp, App, defineAsyncComponent } from "vue";
import PluginType from "@/plugin";
import { t } from "@/lang/helper";

// 懒加载：NDataTable 是 naive-ui 最重组件，延迟到用户打开面板时才加载
const DataPanel = defineAsyncComponent(() => import("./DataPanel.vue"));

export const DATA_ICON: string = "database";
export const DATA_PANEL_VIEW: string = "langr-data-panel";

export class DataPanelView extends ItemView {
	plugin: PluginType;
	vueapp: App;

	constructor(leaf: WorkspaceLeaf, plugin: PluginType) {
		super(leaf);
		this.plugin = plugin;
	}
	getViewType(): string {
		return DATA_PANEL_VIEW;
	}
	getDisplayText(): string {
		return t("Data Panel");
	}
	getIcon(): string {
		return DATA_ICON;
	}
	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.vueapp = createApp(DataPanel);
		this.vueapp.config.globalProperties.plugin = this.plugin;
		this.vueapp.mount(container);
	}
	async onClose() {
		this.vueapp.unmount();
		this.vueapp = null;
	}
}