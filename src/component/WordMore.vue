<template>
    <div class="word-more">
        <div class="word-meaning" v-if="meaning_en || meaning_cn">
            <h2>Meaning:</h2>
            <p v-if="meaning_en"><strong>EN:</strong> {{ meaning_en }}</p>
            <p v-if="meaning_cn"><strong>CN:</strong> {{ meaning_cn }}</p>
        </div>
        <div class="word-notes-section">
            <div style="display:flex; align-items:center; justify-content:space-between;">
                <h2>Notes:</h2>
                <NButton size="tiny" text @click="toggleEdit">
                    {{ editing ? t("Done") : t("Edit") }}
                </NButton>
            </div>
            <div v-if="!editing" class="word-notes">
                <p v-for="n in notes">{{ n }}</p>
                <p v-if="notes.length === 0" style="color: var(--text-muted); font-style: italic;">
                    {{ t("No notes yet. Click Edit to add.") }}
                </p>
            </div>
            <div v-else class="word-notes-edit">
                <NDynamicInput v-model:value="editNotes" :create-button-props="{ size: 'tiny' }">
                    <template #create-button-default>
                        {{ t("Create") }}
                    </template>
                    <template #="{ index, value }">
                        <NInput size="small" type="textarea"
                            v-model:value="editNotes[index]"
                            :placeholder="t('Write a new note')" />
                    </template>
                </NDynamicInput>
                <div style="margin-top: 8px; display:flex; gap:6px;">
                    <NButton size="tiny" type="primary" @click="saveNotes" :loading="saving">
                        {{ t("Save") }}
                    </NButton>
                    <NButton size="tiny" @click="cancelEdit">
                        {{ t("Cancel") }}
                    </NButton>
                </div>
            </div>
        </div>
        <div class="word-sens" v-if="(sentences.length > 0)">
            <h2>Sentences:</h2>
            <div class="word-sen" v-for="sen in sentences">
                <p v-html="sen.text"></p>
                <p v-html="sen.trans"></p>
                <p v-html="sen.origin"></p>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, getCurrentInstance } from 'vue';
import { NButton, NInput, NDynamicInput } from "naive-ui";
import PluginType from "@/plugin";
import { t } from "@/lang/helper";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const props = defineProps<{
    word: string;
}>();

let { sentences, notes, meaning_en, meaning_cn } = await plugin.db.getExpression(props.word);

sentences.forEach((_, i) => {
    sentences[i].text = highlight(sentences[i].text, props.word);
});

function highlight(text: string, word: string) {
    const expr = word.toLowerCase();
    const Expr = word[0].toUpperCase() + word.slice(1);
    text = text.replace(expr, `<em>${expr}</em>`);
    text = text.replace(Expr, `<em>${Expr}</em>`);
    return text;
}

let editing = ref(false);
let editNotes = ref<string[]>([...notes]);
let saving = ref(false);

function toggleEdit() {
    if (editing.value) {
        cancelEdit();
    } else {
        editNotes.value = [...notes];
        editing.value = true;
    }
}

function cancelEdit() {
    editing.value = false;
    editNotes.value = [...notes];
}

async function saveNotes() {
    saving.value = true;
    const expr = await plugin.db.getExpression(props.word);
    expr.notes = editNotes.value.filter(n => n.trim() !== "");
    await plugin.db.postExpression(expr);
    notes.splice(0, notes.length, ...editNotes.value.filter(n => n.trim() !== ""));
    editing.value = false;
    saving.value = false;
}

</script>

<style lang="scss">
.word-more {
    h2 {
        margin: 0.5em 0;
    }

    .word-notes {
        user-select: text;

        p {
            white-space: pre-line;
            margin: 0.5em 5px;
        }
    }

    .word-sens {
        user-select: text;

        .word-sen {
            margin-bottom: 5px;
            border: 1px solid gray;
            border-radius: 5px;

            p {
                &:first-child {
                    font-style: italic;

                    em {
                        font-weight: bold;
                        color: var(--interactive-accent)
                    }
                }

                margin: 0.5em 5px;
            }
        }
    }
}
</style>