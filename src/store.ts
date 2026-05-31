import { reactive } from "vue";

const store = reactive({
    text: "",
    dark: false,
    themeChange: false,
    fontSize: "",
    fontFamily: "",
    lineHeight: "",
    popupSearch: true,
    searchPinned: false,
    dictsChange: false,
    dictHeight: "",
    learnPanelFontSize: "",
});

export default store;