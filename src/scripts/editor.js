class CardEditor {
    constructor() {
        this.container = elementByPath("editor", "div");
        this.textInput = elementByPath("editor/text", "textarea");
        this.altTextInput = elementByPath("editor/image/alt", "textarea");
        this.styleInput = elementByPath("editor/style", "textarea");

        this.iconIconInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => ONE(`#editor-icon-select-${i}`)));
        this.iconActionInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => ONE(`#editor-icon-command-${i}`)));

        const inputs = [this.textInput, ...this.iconIconInputs, ...this.iconActionInputs, this.altTextInput, this.styleInput];
        inputs.forEach((input) => input.addEventListener("input", () => this.pushData(this.card)));

        const imageInput = elementByPath("editor/image", "input");
        setActionHandler("editor/image/upload", () => imageInput.click());
        listen(imageInput, "input", async () => {
            this.card.image = await fileToCompressedImageURL(imageInput.files[0]);
            imageInput.value = "";
            this.pushData(this.card);
        });

        setActionHandler("editor/image/remove", () => {
            this.card.image = undefined;
            this.pushData(this.card);
        });

        setActionHandler("editor/text/bold", () => this.wrapSelectedText("**", "**"));
        setActionHandler("editor/text/italic", () => this.wrapSelectedText("*", "*"));
        setActionHandler("editor/text/strike", () => this.wrapSelectedText("~~", "~~"));
        setActionHandler("editor/text/header", () => this.wrapSelectedText("##", "##"));
    }

    /** @param {DominoDataCard} card */
    open(card) {
        this.container.hidden = false;
        this.card = card;
        this.pullData(this.card);
    }

    close() {
        this.container.hidden = true;
        this.card = undefined;
    }

    /** @param {DominoDataCard} card */
    pullData(card) {
        this.textInput.value = card.text;
        this.altTextInput.value = card.alttext || "";
        this.styleInput.value = card.style || "";

        card.icons.slice(0, 4).forEach((icon, i) => {
            this.iconIconInputs[i].value = icon.icon;
            this.iconActionInputs[i].value = icon.action;
        });

        [0, 1, 2, 3].forEach((i) => {
            const icon = card.icons[i] || { icon: "", action: "" };

            this.iconIconInputs[i].value = icon.icon;
            this.iconActionInputs[i].value = icon.action;
        });
    }

    /** @param {DominoDataCard} card */
    pushData(card) {
        card.text = this.textInput.value;
        card.icons = [0, 1, 2, 3].map((i) => {
            return { 
                icon: this.iconIconInputs[i].value, 
                action: this.iconActionInputs[i].value,
            };
        });
        card.alttext = this.altTextInput.value;
        card.style = this.styleInput.value;

        cardToView.get(card).regenerate();
    }

    /** @param {ClipboardEvent} event */
    async paste(event) {
        if (!this.card) return;

        const image = await dataTransferToImage(event.clipboardData);

        if (image) {
            this.card.image = image;
            this.pushData(this.card);
            killEvent(event);
        }
    }

    /**
     * @param {string} prefix
     * @param {string} suffix
     */
    wrapSelectedText(prefix, suffix) {
        const start = this.textInput.selectionStart;
        const end = this.textInput.selectionEnd;
        const text = this.textInput.value.substring(start, end);
        const prev = this.textInput.value;
        const next = prev.slice(0, start) + prefix + text + suffix + prev.slice(end);

        this.textInput.value = next;
        this.pushData(this.card);

        this.textInput.select();
        this.textInput.setSelectionRange(start + prefix.length, end + prefix.length);
    }
}
