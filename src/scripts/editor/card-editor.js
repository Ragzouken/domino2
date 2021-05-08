class CardEditor {
    constructor() {
        this.container = elementByPath("card-editor", "div");
        this.textInput = elementByPath("card-editor/text", "textarea");
        this.altTextInput = elementByPath("card-editor/image/alt", "textarea");
        this.styleList = elementByPath("card-editor/styles", "select");

        this.iconIconInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => elementByPath(`card-editor/icons/${i}/icon`, "input")));
        this.iconActionInputs = /** @type {HTMLInputElement[]} */ ([1, 2, 3, 4].map((i) => elementByPath(`card-editor/icons/${i}/action`, "input")));

        const inputs = [this.textInput, ...this.iconIconInputs, ...this.iconActionInputs, this.altTextInput];
        inputs.forEach((input) => input.addEventListener("input", () => this.pushData(this.card)));

        setActionHandler("card-editor/image/upload", async () => {
            const [file] = await pickFiles("image/*");
            this.card.image = await fileToCompressedImageURL(file);
            this.pushData(this.card);
        });

        setActionHandler("card-editor/image/remove", () => {
            this.card.image = undefined;
            this.pushData(this.card);
        });

        setActionHandler("card-editor/text/bold", () => this.wrapSelectedText("**", "**"));
        setActionHandler("card-editor/text/italic", () => this.wrapSelectedText("*", "*"));
        setActionHandler("card-editor/text/strike", () => this.wrapSelectedText("~~", "~~"));
        setActionHandler("card-editor/text/header", () => this.wrapSelectedText("##", "##"));

        setActionHandler("card-editor/styles/edit", () => {
            cardStyleEditor.open();
            cardStyleEditor.setSelectedStyle(this.styleList.value);
        });

        this.styleList.addEventListener("change", () => {
            this.card.cardStyle = this.styleList.value;
            this.pushData(this.card);
        });
    }

    /** @param {DominoDataCard} card */
    open(card) {
        this.container.hidden = false;
        this.card = card;

        refreshDropdown(
            this.styleList,
            [{id: "", name: "default"}, ...boardView.projectData.cardStyles],
            (style) => html("option", { value: style.id }, style.name),
        );

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
        this.styleList.value = card.cardStyle ?? "";

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

        boardView.cardToView.get(card).regenerate();
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
